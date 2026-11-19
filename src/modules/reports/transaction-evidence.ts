import type { Types } from 'mongoose';
import type { Transaction } from '../transactions/schemas/transaction.schema';
import type { SavedReportTransaction } from './schemas/budget-period-report.schema';

export function transactionEvidence(
  transactionId: Types.ObjectId,
  row: Transaction,
): SavedReportTransaction {
  return {
    transactionId: transactionId.toString(),
    budgetItemId: row.budgetItemId?.toString().toLowerCase() ?? null,
    accountId: row.accountId?.toString(),
    date: row.date,
    name: row.name,
    amount: row.amount,
    type: row.type,
    currency: row.currency ?? null,
    currencyContextVersion: row.currencyContextVersion,
    currencyOrigin: row.currencyOrigin,
    source: row.source,
    sourceMessageId: row.sourceMessageId,
    parserKey: row.parserKey,
    parserVersion: row.parserVersion,
    matchingStatus: row.matchingStatus,
    matchingSource: row.matchingSource,
    matchingConfidence: row.matchingConfidence,
    rawDescription: row.rawDescription,
    normalizedMerchant: row.normalizedMerchant,
    relationCode: row.relationCode,
    notes: row.notes,
  };
}
