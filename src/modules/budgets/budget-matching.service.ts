import { Injectable } from '@nestjs/common';
import { Types } from 'mongoose';
import { MerchantNormalizationService } from '@/modules/transactions/merchant-normalization.service';
import { Transaction } from '@/modules/transactions/schemas/transaction.schema';
import { BudgetMatchingContext } from './budget-matching-context.service';

type MatchableTransaction = Pick<
  Transaction,
  'userId' | 'date' | 'type' | 'name'
> &
  Partial<Transaction> & { merchant?: string };

@Injectable()
export class BudgetMatchingService {
  constructor(private readonly normalization: MerchantNormalizationService) {}

  matchTransaction<T extends MatchableTransaction>(
    transaction: T,
    context: BudgetMatchingContext,
  ): T {
    if (
      transaction.matchingStatus === 'manual' ||
      transaction.matchingSource === 'manual'
    ) {
      return transaction;
    }

    const budgets =
      context.userId.toString() === transaction.userId.toString()
        ? context.budgets.filter(
            (budget) =>
              budget.userId.toString() === transaction.userId.toString() &&
              budget.status === 'active' &&
              !budget.isDeleted &&
              budget.startDate <= transaction.date &&
              budget.endDate >= transaction.date,
          )
        : [];
    const budgetIds = new Set(budgets.map((budget) => budget._id.toString()));
    const items = context.items;

    const merchant = this.normalization.normalize(
      transaction.normalizedMerchant ??
        transaction.merchant ??
        transaction.rawDescription ??
        transaction.name,
    );
    const description = this.normalization.normalize(
      transaction.rawDescription ?? transaction.name,
    );
    transaction.normalizedMerchant = merchant;

    const matches = items.filter(
      (item) =>
        item.userId.toString() === transaction.userId.toString() &&
        budgetIds.has(item.budgetId.toString()) &&
        !item.isDeleted &&
        item.type === transaction.type &&
        item.matchingRules?.some((rule) => {
          const value = this.normalization.normalize(rule.value);
          const actual = rule.field === 'merchant' ? merchant : description;
          if (!value || !actual) return false;
          return rule.operator === 'equals'
            ? actual === value
            : rule.operator === 'contains' && actual.includes(value);
        }),
    );

    if (matches.length === 1) {
      transaction.budgetItemId = matches[0]._id as Types.ObjectId;
      transaction.matchingStatus = 'matched';
      transaction.matchingSource = 'rule';
    } else {
      transaction.budgetItemId = undefined;
      transaction.matchingStatus = 'needs_review';
      transaction.matchingSource = undefined;
    }
    transaction.matchingConfidence = undefined;
    return transaction;
  }
}
