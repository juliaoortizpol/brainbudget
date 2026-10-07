import { Types } from 'mongoose';
import { MerchantNormalizationService } from '@/modules/transactions/merchant-normalization.service';
import { BudgetMatchingService } from './budget-matching.service';

describe('BudgetMatchingService', () => {
  const userId = new Types.ObjectId();
  const budgetId = new Types.ObjectId();
  const item = {
    _id: new Types.ObjectId(),
    userId,
    budgetId,
    type: 'expense',
    isDeleted: false,
    matchingRules: [
      {
        id: 'rule-1',
        field: 'merchant',
        operator: 'contains',
        value: ' UBER ',
        source: 'user',
      },
    ],
  };
  const service = new BudgetMatchingService(new MerchantNormalizationService());
  const budget = {
    _id: budgetId,
    userId,
    status: 'active',
    isDeleted: false,
    startDate: new Date('2026-10-01'),
    endDate: new Date('2026-10-31'),
  };
  const match = (transaction: any, items: any[]) =>
    service.matchTransaction(transaction, {
      userId,
      budgets: [budget] as any,
      items,
    });
  const transaction = () => ({
    userId,
    date: new Date('2026-10-07'),
    type: 'expense',
    name: 'UBER *TRIP HELP.UBER.COM',
  });

  it('assigns a normalized merchant rule match', async () => {
    const result = await match(transaction(), [item] as any);
    expect(result).toMatchObject({
      budgetItemId: item._id,
      matchingStatus: 'matched',
      matchingSource: 'rule',
      normalizedMerchant: 'uber',
    });
  });

  it.each([
    { userId: new Types.ObjectId() },
    { budgetId: new Types.ObjectId() },
    { isDeleted: true },
    { type: 'income' },
    {
      matchingRules: [
        { field: 'merchant', operator: 'equals', value: 'uber eats' },
      ],
    },
    {
      matchingRules: [
        { field: 'merchant', operator: 'contains', value: '***' },
      ],
    },
  ])('rejects ineligible items: %j', async (override) => {
    expect(
      await match(transaction(), [{ ...item, ...override }] as any),
    ).toMatchObject({
      matchingStatus: 'needs_review',
      budgetItemId: undefined,
    });
  });

  it('matches description equals after normalization', async () => {
    const candidate = {
      ...item,
      matchingRules: [
        { field: 'description', operator: 'equals', value: 'Monthly, RENT!' },
      ],
    };
    expect(
      await match({ ...transaction(), name: ' monthly rent ' }, [
        candidate,
      ] as any),
    ).toMatchObject({ matchingStatus: 'matched' });
  });

  it('leaves conflicting matches for review', async () => {
    expect(
      await match(transaction(), [
        item,
        { ...item, _id: new Types.ObjectId() },
      ] as any),
    ).toMatchObject({ matchingStatus: 'needs_review' });
  });

  it('preserves manual assignments', async () => {
    const manual = {
      ...transaction(),
      matchingStatus: 'manual' as const,
      budgetItemId: item._id,
    };
    expect(await match(manual, [])).toEqual(manual);
  });

  it.each([
    { status: 'closed' },
    { isDeleted: true },
    { userId: new Types.ObjectId() },
    { startDate: new Date('2026-11-01') },
    { endDate: new Date('2026-10-06') },
  ])('rejects an irrelevant budget: %j', (override) => {
    expect(
      service.matchTransaction(transaction(), {
        userId,
        budgets: [{ ...budget, ...override }] as any,
        items: [item] as any,
      }),
    ).toMatchObject({ matchingStatus: 'needs_review' });
  });
});
