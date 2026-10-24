import type { BudgetMatchingContext } from './budget-matching-context.service';
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
  const match = (
    transaction: Parameters<BudgetMatchingService['matchTransaction']>[0],
    items: unknown[],
  ) =>
    service.matchTransaction(transaction, {
      userId,
      budgets: [budget] as unknown as BudgetMatchingContext['budgets'],
      items: items as BudgetMatchingContext['items'],
    });
  const transaction = () => ({
    userId,
    date: new Date('2026-10-07'),
    type: 'expense',
    name: 'UBER *TRIP HELP.UBER.COM',
  });

  it('assigns a normalized merchant rule match', () => {
    const result = match(transaction(), [item]);
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
  ])('rejects ineligible items: %j', (override) => {
    expect(match(transaction(), [{ ...item, ...override }])).toMatchObject({
      matchingStatus: 'needs_review',
      budgetItemId: undefined,
    });
  });

  it('matches description equals after normalization', () => {
    const candidate = {
      ...item,
      matchingRules: [
        { field: 'description', operator: 'equals', value: 'Monthly, RENT!' },
      ],
    };
    expect(
      match({ ...transaction(), name: ' monthly rent ' }, [candidate]),
    ).toMatchObject({ matchingStatus: 'matched' });
  });

  it('leaves conflicting matches for review', () => {
    expect(
      match(transaction(), [item, { ...item, _id: new Types.ObjectId() }]),
    ).toMatchObject({ matchingStatus: 'needs_review' });
  });

  it('preserves manual assignments', () => {
    const manual = {
      ...transaction(),
      matchingStatus: 'manual' as const,
      budgetItemId: item._id,
    };
    expect(match(manual, [])).toEqual(manual);
  });

  const candidate = (
    value: string,
    operator = 'contains',
    source = 'user',
    field = 'merchant',
  ) => ({
    ...item,
    _id: new Types.ObjectId(),
    matchingRules: [{ id: 'rule', value, operator, source, field }],
  });

  it.each([false, true])(
    'prefers uber eats over uber regardless of item order (%s)',
    (reverse) => {
      const transportation = candidate('uber');
      const eatingOut = candidate(' UBER   EATS! ');
      const items = [transportation, eatingOut];
      if (reverse) items.reverse();
      expect(
        match({ ...transaction(), name: 'UBER EATS' }, items),
      ).toMatchObject({
        budgetItemId: eatingOut._id,
        matchingStatus: 'matched',
        matchingSource: 'rule',
      });
    },
  );

  it('prefers exact equality over a longer partial match on another field', () => {
    const exact = candidate('uber', 'equals', 'suggested');
    const partial = candidate(
      'monthly payment',
      'contains',
      'user',
      'description',
    );
    expect(
      match(
        {
          ...transaction(),
          normalizedMerchant: 'uber',
          rawDescription: 'monthly payment receipt',
        },
        [partial, exact],
      ),
    ).toMatchObject({ budgetItemId: exact._id });
  });

  it('prefers a longer partial match before rule source', () => {
    const shorter = candidate('uber', 'contains', 'user');
    const longer = candidate('uber eats', 'contains', 'suggested');
    expect(
      match({ ...transaction(), name: 'UBER EATS ORDER' }, [shorter, longer]),
    ).toMatchObject({ budgetItemId: longer._id });
  });

  it.each(['user', 'learned'])(
    'prefers %s rules over equally specific suggestions',
    (source) => {
      const suggested = candidate('uber eats', 'equals', 'suggested');
      const preferred = candidate('uber eats', 'equals', source);
      expect(
        match({ ...transaction(), name: 'UBER EATS' }, [suggested, preferred]),
      ).toMatchObject({ budgetItemId: preferred._id });
    },
  );

  it('leaves equally specific user and learned rules for review and clears old metadata', () => {
    expect(
      match(
        {
          ...transaction(),
          name: 'UBER EATS',
          budgetItemId: item._id,
          matchingStatus: 'matched',
          matchingSource: 'rule',
          matchingConfidence: 0.9,
        },
        [
          candidate('uber eats', 'equals', 'user'),
          candidate('uber eats', 'equals', 'learned'),
        ],
      ),
    ).toMatchObject({
      matchingStatus: 'needs_review',
      budgetItemId: undefined,
      matchingSource: undefined,
      matchingConfidence: undefined,
    });
  });

  it('treats multiple equally ranked rules on the same item as one winner', () => {
    const winner = candidate('uber eats');
    winner.matchingRules.push({
      ...winner.matchingRules[0],
      id: 'second-rule',
    });
    expect(
      match({ ...transaction(), name: 'UBER EATS' }, [
        candidate('uber'),
        winner,
      ]),
    ).toMatchObject({ budgetItemId: winner._id, matchingStatus: 'matched' });
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
        budgets: [
          { ...budget, ...override },
        ] as unknown as BudgetMatchingContext['budgets'],
        items: [item] as unknown as BudgetMatchingContext['items'],
      }),
    ).toMatchObject({ matchingStatus: 'needs_review' });
  });
});
