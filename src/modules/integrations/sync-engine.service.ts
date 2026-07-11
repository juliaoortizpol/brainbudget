import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { google } from 'googleapis';
import { IntegrationsService } from './integrations.service';
import { EmailParserService } from '@/modules/email-parser/services/email-parser.service';
import {
  Transaction,
  TransactionDocument,
} from '@/modules/transactions/schemas/transaction.schema';
import {
  Account,
  AccountDocument,
} from '@/modules/accounts/schemas/account.schema';
import { extractMessageBody } from './gmail-message.utils';

@Injectable()
export class SyncEngineService {
  private readonly logger = new Logger(SyncEngineService.name);

  constructor(
    private readonly integrationsService: IntegrationsService,
    private readonly emailParserService: EmailParserService,
    @InjectModel(Transaction.name)
    private transactionModel: Model<TransactionDocument>,
    @InjectModel(Account.name) private accountModel: Model<AccountDocument>,
  ) {}

  async syncEmailsForUser(userId: string) {
    this.logger.log(`Starting sync for user ${userId}`);
    const connection =
      await this.integrationsService.getGmailConnection(userId);

    if (
      !connection ||
      connection.status !== 'active' ||
      !connection.refreshToken
    ) {
      this.logger.warn(
        `User ${userId} does not have an active Gmail connection`,
      );
      return { success: false, message: 'No active connection' };
    }

    // Initialize Gmail client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
    );
    oauth2Client.setCredentials({ refresh_token: connection.refreshToken });
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // 1. Get all active configs
    const configs = await this.emailParserService.getActiveConfigs();
    let totalProcessed = 0;
    let totalSaved = 0;

    for (const config of configs) {
      for (const rule of config.parsingRules) {
        // Build query
        // E.g., from:JULIO5001@hotmail.com subject:"Notificaciones Banreservas"
        let query = `from:${rule.senderEmail}`;
        if (rule.subjectKeywords.length > 0) {
          const subjects = rule.subjectKeywords
            .map((keyword) => `subject:"${keyword}"`)
            .join(' OR ');
          query += ` {${subjects}}`;
        }

        // Add time constraint
        if (connection.lastSyncedAt) {
          const timestamp = Math.floor(
            connection.lastSyncedAt.getTime() / 1000,
          );
          query += ` after:${timestamp}`;
        } else {
          // Default to 7 days if first sync
          query += ` newer_than:7d`;
        }

        this.logger.debug(`Searching Gmail with query: ${query}`);

        try {
          const listResponse = await gmail.users.messages.list({
            userId: 'me',
            q: query,
            maxResults: 50,
          });

          const messages = listResponse.data.messages || [];
          this.logger.debug(
            `Found ${messages.length} messages for rule ${rule.parserCodeId}`,
          );

          for (const msg of messages) {
            totalProcessed++;
            const msgId = msg.id!;

            // 2. Deduplication check!
            const exists = await this.transactionModel.exists({
              externalId: msgId,
              userId: new Types.ObjectId(userId),
            });
            if (exists) {
              this.logger.debug(`Skipping msg ${msgId} - already processed`);
              continue;
            }

            // Fetch full email
            const msgResponse = await gmail.users.messages.get({
              userId: 'me',
              id: msgId,
              format: 'full',
            });

            // Extract subject and body
            const headers = msgResponse.data.payload?.headers || [];
            const subject =
              headers.find((h) => h.name === 'Subject')?.value || '';
            const sender = headers.find((h) => h.name === 'From')?.value || '';

            const bodyData = extractMessageBody(msgResponse.data.payload);

            // 3. Parse Email
            const parsedResult = await this.emailParserService.parseEmail(
              sender,
              subject,
              bodyData,
            );

            if (parsedResult) {
              // 4. Resolve Account
              // In a real scenario, you'd match by last4Digits if the parser returns it.
              // For now, we just find the first account of that type for the user.
              const account = await this.accountModel.findOne({
                userId: new Types.ObjectId(userId),
                institution: parsedResult.institutionName,
                type: parsedResult.accountType,
                isDeleted: { $ne: true },
              });

              // 5. Save Transaction
              const newTx = new this.transactionModel({
                userId: new Types.ObjectId(userId),
                accountId: account ? account._id : undefined,
                name: parsedResult.transaction.description,
                amount: parsedResult.transaction.amount,
                type: parsedResult.transaction.type,
                date: parsedResult.transaction.date,
                externalId: msgId,
                notes: `Parsed from Gmail. Institution: ${parsedResult.institutionName}`,
              });

              await newTx.save();
              totalSaved++;
              this.logger.log(
                `Saved new transaction from email: ${parsedResult.transaction.description}`,
              );
            }
          }
        } catch (error: any) {
          this.logger.error(
            `Error processing rule for ${config.name}: ${error.message}`,
          );
        }
      }
    }

    // Update lastSyncedAt
    connection.lastSyncedAt = new Date();
    await connection.save();

    return {
      success: true,
      processed: totalProcessed,
      saved: totalSaved,
    };
  }
}
