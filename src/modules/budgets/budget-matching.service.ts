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

    const eligibleItems = items.filter(
      (item) =>
        item.userId.toString() === transaction.userId.toString() &&
        budgetIds.has(item.budgetId.toString()) &&
        !item.isDeleted &&
        item.type === transaction.type,
    );
    type Rank = [exact: number, length: number, preferredSource: number];
    const compare = (a: Rank, b: Rank): number =>
      a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
    let bestRank: Rank | undefined;
    const winners = new Map<string, Types.ObjectId>();

    for (const item of eligibleItems) {
      for (const rule of item.matchingRules ?? []) {
        const value = this.normalization.normalize(rule.value);
        const actual = rule.field === 'merchant' ? merchant : description;
        if (!value || !actual) continue;
        const matches =
          rule.operator === 'equals'
            ? actual === value
            : rule.operator === 'contains' && actual.includes(value);
        if (!matches) continue;
        const rank: Rank = [
          Number(actual === value),
          value.length,
          Number(rule.source === 'user' || rule.source === 'learned'),
        ];
        const comparison = bestRank ? compare(rank, bestRank) : 1;
        if (comparison > 0) {
          bestRank = rank;
          winners.clear();
        }
        if (comparison >= 0) {
          winners.set(item._id.toString(), item._id as Types.ObjectId);
        }
      }
    }

    if (winners.size === 1) {
      transaction.budgetItemId = winners.values().next().value;
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
