import { ClosedPeriodHistoryService } from '../reports/closed-period-history.service';
import { ConflictException, Injectable } from '@nestjs/common';
import { BudgetMatchingService } from '@/modules/budgets/budget-matching.service';
import { BudgetMatchingContextService } from '@/modules/budgets/budget-matching-context.service';
import { coverageWrite } from '@/modules/budgets/coverage-write';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { MerchantNormalizationService } from '@/modules/transactions/merchant-normalization.service';
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
    private readonly merchantNormalization: MerchantNormalizationService,
    private readonly budgetMatching: BudgetMatchingService,
    private readonly matchingContext: BudgetMatchingContextService,
    private readonly closedHistory: ClosedPeriodHistoryService,
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

    if (!envelopes.length) return result;

    for (const envelope of envelopes) {
      try {
        const writeResult = await coverageWrite(
          this.transactionModel.db,
          userId,
          async (session) => {
            const owner = new Types.ObjectId(userId);
            const transaction = envelope.transaction;
            const date = transaction.transactionDate;
            const links = await this.closedHistory.links(
              owner,
              [date],
              session,
            );
            const covered = this.closedHistory.isCovered(links, date);
            const normalizedMerchant = this.merchantNormalization.normalize(
              transaction.description,
            );
            const matching = covered
              ? {
                  matchingStatus: 'needs_review' as const,
                  normalizedMerchant,
                  budgetItemId: undefined,
                  matchingSource: undefined,
                }
              : this.budgetMatching.matchTransaction(
                  {
                    userId: owner,
                    name: transaction.description,
                    rawDescription: transaction.description,
                    normalizedMerchant,
                    date: transaction.transactionDate,
                    type: transaction.type,
                    currency: transaction.currency,
                  } as Transaction,
                  await this.matchingContext.load(userId, session),
                );
            const inserted: Transaction = {
              userId: owner,
              accountId: new Types.ObjectId(envelope.accountId),
              name: transaction.description,
              budgetItemId: matching.budgetItemId,
              matchingStatus: matching.matchingStatus,
              matchingSource: matching.matchingSource,
              rawDescription: transaction.description,
              normalizedMerchant: matching.normalizedMerchant,
              amount: transaction.amount,
              type: transaction.type,
              currency: transaction.currency,
              currencyContextVersion: 1,
              currencyOrigin: 'mail-parser',
              relationCode: transaction.reference,
              date: transaction.transactionDate,
              source: TransactionSource.GMAIL,
              sourceMessageId: envelope.messageId,
              parserKey: envelope.parserKey,
              parserVersion: envelope.parserVersion,
            };
            const write = await this.transactionModel
              .updateOne(
                {
                  userId: owner,
                  source: TransactionSource.GMAIL,
                  sourceMessageId: envelope.messageId,
                },
                { $setOnInsert: inserted },
                { upsert: true, runValidators: true, session },
              )
              .exec()
              .catch((error: unknown) => {
                if (this.isDuplicateKeyError(error))
                  throw new ConflictException('Duplicate imported message');
                throw error;
              });
            if (write.upsertedCount === 1 && links.length) {
              if (!write.upsertedId)
                throw new Error('Missing imported transaction identity');
              await this.closedHistory.record(
                owner,
                write.upsertedId,
                links,
                null,
                inserted,
                session,
              );
            }
            return write;
          },
        );

        if (writeResult.upsertedCount === 1) {
          result.transactionsCreated++;
        } else {
          result.duplicatesSkipped++;
        }
      } catch (error) {
        if (error instanceof ConflictException) {
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
