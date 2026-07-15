import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Transaction,
  TransactionDocument,
  TransactionSource,
} from '@/modules/transactions/schemas/transaction.schema';
import {
  MailTransactionPersistenceIssueCode,
  MailTransactionPersistenceResult,
  MatchedMailTransactionEnvelope,
} from './contracts';

@Injectable()
export class TransactionMailPersistenceService {
  constructor(
    @InjectModel(Transaction.name)
    private readonly transactionModel: Model<TransactionDocument>,
  ) {}

  async save(
    userId: string,
    envelopes: MatchedMailTransactionEnvelope[],
  ): Promise<MailTransactionPersistenceResult> {
    const result: MailTransactionPersistenceResult = {
      transactionsAttempted: envelopes.length,
      transactionsCreated: 0,
      duplicatesSkipped: 0,
      transactionsFailed: 0,
      issues: [],
    };

    for (const envelope of envelopes) {
      try {
        const transaction = envelope.transaction;
        const writeResult = await this.transactionModel
          .updateOne(
            {
              userId: new Types.ObjectId(userId),
              source: TransactionSource.GMAIL,
              sourceMessageId: envelope.messageId,
            },
            {
              $setOnInsert: {
                userId: new Types.ObjectId(userId),
                accountId: new Types.ObjectId(envelope.accountId),
                name: transaction.description,
                amount: transaction.amount,
                type: transaction.type,
                currency: transaction.currency,
                relationCode: transaction.reference,
                date: transaction.transactionDate,
                source: TransactionSource.GMAIL,
                sourceMessageId: envelope.messageId,
                parserKey: envelope.parserKey,
                parserVersion: envelope.parserVersion,
              },
            },
            { upsert: true, runValidators: true },
          )
          .exec();

        if (writeResult.upsertedCount === 1) {
          result.transactionsCreated++;
        } else {
          result.duplicatesSkipped++;
        }
      } catch (error) {
        if (this.isDuplicateKeyError(error)) {
          result.duplicatesSkipped++;
          continue;
        }

        result.transactionsFailed++;
        result.issues.push({
          messageId: envelope.messageId,
          code: MailTransactionPersistenceIssueCode.SAVE_FAILED,
        });
      }
    }

    return result;
  }

  private isDuplicateKeyError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 11000
    );
  }
}
