import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Model, Types } from 'mongoose';
import { TransactionsService } from './transactions.service';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { TransactionDocument } from './schemas/transaction.schema';
import { BudgetDocument } from '../budgets/schemas/budget.schema';
import { BudgetItemDocument } from '../budgets/schemas/budget-item.schema';
import { BudgetItemMatchingRule } from '../budgets/schemas/budget-item-matching-rule.schema';
import { BudgetMatchingService } from '../budgets/budget-matching.service';
import { MerchantNormalizationService } from './merchant-normalization.service';
import { BudgetMatchingContext } from '../budgets/budget-matching-context.service';

describe('remember assignment (controlled persistence)', () => {
  const userId = new Types.ObjectId();
  const id = new Types.ObjectId();
  const itemId = new Types.ObjectId();
  const budgetId = new Types.ObjectId();
  const request = {
    budgetItemId: String(itemId),
    rememberMerchant: true,
    merchantKeyword: 'Synthetic Shop',
  };
  let rules: BudgetItemMatchingRule[];
  let transaction: Record<string, unknown>;
  let service: TransactionsService;
  let failItem: boolean;
  let failTransaction: boolean;
  let unavailable: boolean;
  let itemAvailable: boolean;
  let transactionAvailable: boolean;
  let itemWrite: jest.Mock;
  let transactionWrite: jest.Mock<
    unknown,
    [unknown, { $set: Record<string, unknown> }, { session?: unknown }]
  >;
  let session: { withTransaction: jest.Mock; endSession: jest.Mock };
  const query = <T>(value: T) => ({ exec: () => Promise.resolve(value) });

  beforeEach(() => {
    rules = [
      {
        id: 'advanced',
        field: 'description',
        operator: 'equals',
        value: ' RAW Advanced ',
        source: 'user',
      },
    ];
    transaction = {
      userId,
      date: new Date('2026-11-03'),
      type: 'expense',
      matchingStatus: 'needs_review',
    };
    failItem = failTransaction = unavailable = false;
    itemAvailable = transactionAvailable = true;
    session = {
      withTransaction: jest.fn(async (callback: () => Promise<unknown>) => {
        if (unavailable) throw new Error('Transactions unavailable');
        const originalRules = structuredClone(rules);
        const originalTransaction = { ...transaction };
        try {
          return await callback();
        } catch (error) {
          rules = originalRules;
          transaction = originalTransaction;
          throw error;
        }
      }),
      endSession: jest.fn().mockResolvedValue(undefined),
    };
    itemWrite = jest.fn(
      (
        _filter: unknown,
        update: {
          $push?: { matchingRules: BudgetItemMatchingRule };
          $set?: unknown;
        },
        options: { session: unknown },
      ) => ({
        exec: () => {
          expect(options.session).toBe(session);
          if (failItem)
            return Promise.reject(new Error('item persistence failed'));
          if (update.$push) rules.push(update.$push.matchingRules);
          else {
            const candidate = rules.find((rule) => rule.field === 'merchant');
            if (candidate) candidate.source = 'learned';
          }
          return Promise.resolve({ matchedCount: 1 });
        },
      }),
    );
    transactionWrite = jest.fn(
      (
        _filter: unknown,
        update: { $set: Record<string, unknown> },
        options: { session?: unknown },
      ) => ({
        exec: () => {
          if (request.rememberMerchant && options.session)
            expect(options.session).toBe(session);
          if (failTransaction)
            return Promise.reject(new Error('transaction persistence failed'));
          transaction = { ...transaction, ...update.$set };
          return Promise.resolve(transaction);
        },
      }),
    );
    const transactions = {
      db: {
        startSession: jest.fn().mockResolvedValue(session),
        collection: () => ({
          updateOne: jest.fn().mockResolvedValue({ matchedCount: 1 }),
        }),
      },
      findOne: jest.fn(() => query(transactionAvailable ? transaction : null)),
      findOneAndUpdate: transactionWrite,
    };
    const items = {
      findOne: jest.fn(() =>
        query(
          itemAvailable
            ? {
                _id: itemId,
                userId,
                budgetId,
                type: 'expense',
                matchingRules: rules,
              }
            : null,
        ),
      ),
      updateOne: itemWrite,
    };
    const budgets = {
      findOne: jest.fn(() =>
        query({
          status: 'active',
          startDate: new Date('2026-11-01'),
          endDate: new Date('2026-11-30'),
        }),
      ),
    };
    service = new TransactionsService(
      transactions as unknown as Model<TransactionDocument>,
      budgets as unknown as Model<BudgetDocument>,
      items as unknown as Model<BudgetItemDocument>,
    );
  });

  it('requires explicit true and strips controls from ordinary assignments', async () => {
    await service.update(String(id), String(userId), {
      ...request,
      rememberMerchant: false,
    });
    expect(itemWrite).not.toHaveBeenCalled();
    expect(session.withTransaction).toHaveBeenCalledTimes(1);
    expect(transaction).not.toHaveProperty('rememberMerchant');
    expect(transaction).not.toHaveProperty('merchantKeyword');
  });

  it('learns once across normalized retries and preserves unrelated advanced metadata', async () => {
    const before = { ...rules[0] };
    await service.update(String(id), String(userId), request);
    await service.update(String(id), String(userId), {
      ...request,
      merchantKeyword: 'SYNTHETIC   SHOP!',
    });
    expect(rules).toHaveLength(2);
    expect(rules[0]).toEqual(before);
    expect(rules[1]).toMatchObject({
      field: 'merchant',
      operator: 'contains',
      source: 'learned',
      value: request.merchantKeyword,
    });
    expect(itemWrite).toHaveBeenCalledTimes(1);
    for (const call of transactionWrite.mock.calls) {
      expect(call[2]).toMatchObject({ session });
    }
    expect(transaction).toMatchObject({
      matchingStatus: 'manual',
      matchingSource: 'manual',
    });
    expect(transaction).not.toHaveProperty('rememberMerchant');
    expect(transaction).not.toHaveProperty('merchantKeyword');
    expect(session.endSession).toHaveBeenCalledTimes(2);
  });

  it.each(['user', 'learned', 'suggested'] as const)(
    'reuses %s rules preserving identity and raw value',
    async (source) => {
      rules.push({
        id: 'existing',
        field: 'merchant',
        operator: 'contains',
        source,
        value: ' SYNTHETIC SHOP! ',
      });
      await service.update(String(id), String(userId), request);
      expect(rules).toHaveLength(2);
      expect(rules[1]).toEqual({
        id: 'existing',
        field: 'merchant',
        operator: 'contains',
        source: source === 'suggested' ? 'learned' : source,
        value: ' SYNTHETIC SHOP! ',
      });
      expect(itemWrite).toHaveBeenCalledTimes(source === 'suggested' ? 1 : 0);
    },
  );

  it('rechecks equivalence on a fresh transaction callback after a competing learner commits', async () => {
    session.withTransaction.mockImplementationOnce(
      async (callback: () => Promise<unknown>) => {
        // Controlled driver retry: discard this attempt, expose a competitor's
        // committed rule, then rerun the callback against the fresh snapshot.
        const before = { ...transaction };
        await callback();
        transaction = before;
        rules = [
          rules[0],
          {
            id: 'competitor',
            field: 'merchant',
            operator: 'contains',
            value: 'SYNTHETIC SHOP!',
            source: 'learned',
          },
        ];
        return callback();
      },
    );
    await service.update(String(id), String(userId), request);
    expect(rules).toHaveLength(2);
    expect(rules[1].id).toBe('competitor');
    expect(itemWrite).toHaveBeenCalledTimes(1);
    expect(transaction.matchingStatus).toBe('manual');
  });

  it.each([undefined, '', '!!!', 'a'.repeat(257)])(
    'rejects unusable keyword %p before writes',
    async (merchantKeyword) => {
      await expect(
        service.update(String(id), String(userId), {
          ...request,
          merchantKeyword,
        }),
      ).rejects.toThrow('searchable keyword');
      expect(itemWrite).not.toHaveBeenCalled();
      expect(transactionWrite).not.toHaveBeenCalled();
    },
  );

  it.each(['transaction', 'item', 'income', 'clear', 'limit'] as const)(
    'rejects invalid %s without mutation',
    async (scenario) => {
      if (scenario === 'transaction') transactionAvailable = false;
      if (scenario === 'item') itemAvailable = false;
      if (scenario === 'income') transaction.type = 'income';
      if (scenario === 'limit')
        rules = Array.from({ length: 100 }, (_, index) => ({
          id: String(index),
          field: 'description',
          operator: 'equals',
          value: `Synthetic ${index}`,
          source: 'user',
        }));
      const before = structuredClone(rules);
      await expect(
        service.update(String(id), String(userId), {
          ...request,
          ...(scenario === 'clear' ? { budgetItemId: null } : {}),
        }),
      ).rejects.toThrow();
      expect(rules).toEqual(before);
      expect(transactionWrite).not.toHaveBeenCalled();
    },
  );

  it.each(['item', 'transaction', 'unavailable'] as const)(
    'fails safely at %s boundary with rollback requested',
    async (boundary) => {
      failItem = boundary === 'item';
      failTransaction = boundary === 'transaction';
      unavailable = boundary === 'unavailable';
      const before = { ...transaction };
      await expect(
        service.update(String(id), String(userId), request),
      ).rejects.toThrow('transactional database required');
      expect(rules).toHaveLength(1);
      expect(transaction).toEqual(before);
      expect(session.endSession).toHaveBeenCalled();
    },
  );

  it('feeds future matches into the existing matcher without rematching manual history', async () => {
    await service.update(String(id), String(userId), request);
    const matcher = new BudgetMatchingService(
      new MerchantNormalizationService(),
    );
    const context = {
      userId,
      budgets: [
        {
          _id: budgetId,
          userId,
          status: 'active',
          startDate: new Date('2026-11-01'),
          endDate: new Date('2026-11-30'),
        },
      ],
      items: [
        {
          _id: itemId,
          budgetId,
          userId,
          type: 'expense',
          matchingRules: rules,
        },
      ],
    } as unknown as BudgetMatchingContext;
    const future = {
      userId,
      date: new Date('2026-11-04'),
      type: 'expense',
      name: 'Synthetic Shop',
      normalizedMerchant: 'synthetic shop',
      budgetItemId: undefined as Types.ObjectId | undefined,
    };
    expect(matcher.matchTransaction(future, context).budgetItemId).toEqual(
      itemId,
    );
    const history = {
      ...future,
      budgetItemId: new Types.ObjectId(),
      matchingStatus: 'manual' as const,
    };
    expect(matcher.matchTransaction(history, context)).toBe(history);
  });

  it.each([
    { rememberMerchant: 'true' },
    { rememberMerchant: null },
    { rememberMerchant: true },
    { rememberMerchant: true, merchantKeyword: null },
  ])('rejects malformed HTTP controls %j', async (payload) => {
    expect(
      (await validate(plainToInstance(UpdateTransactionDto, payload))).length,
    ).toBeGreaterThan(0);
  });
});
