import { BadRequestException } from '@nestjs/common';
import { Model, Types } from 'mongoose';
import { TransactionsService } from './transactions.service';
import { TransactionDocument } from './schemas/transaction.schema';
import { BudgetDocument } from '../budgets/schemas/budget.schema';
import { BudgetItemDocument } from '../budgets/schemas/budget-item.schema';
import { BudgetMatchingService } from '../budgets/budget-matching.service';
import { MerchantNormalizationService } from './merchant-normalization.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

describe('manual transaction assignments', () => {
  const userId = new Types.ObjectId().toString();
  const id = new Types.ObjectId().toString();
  const itemId = new Types.ObjectId().toString();
  const payload = {
    name: 'Synthetic purchase',
    amount: 12,
    type: 'expense',
    date: '2026-11-01T00:00:00.000Z',
  };
  let saved: Record<string, unknown>;
  let update: jest.Mock<
    unknown,
    [
      unknown,
      { $set: Record<string, unknown>; $unset?: Record<string, number> },
    ]
  >;
  let items: { findOne: jest.Mock<unknown, [Record<string, unknown>]> };
  let budgets: { findOne: jest.Mock<unknown, [Record<string, unknown>]> };
  let service: TransactionsService;
  let current: Record<string, unknown>;
  let item: Record<string, unknown> | null;
  let budget: Record<string, unknown> | null;

  beforeEach(() => {
    saved = {};
    current = {
      ...payload,
      date: new Date(payload.date),
      budgetItemId: new Types.ObjectId(itemId),
    };
    item = { budgetId: new Types.ObjectId(), type: 'expense' };
    budget = {
      status: 'active',
      startDate: new Date('2026-11-01T00:00:00Z'),
      endDate: new Date('2026-11-30T00:00:00Z'),
    };
    class TransactionModel {
      constructor(data: Record<string, unknown>) {
        saved = data;
      }
      save() {
        return Promise.resolve(saved);
      }
      static findOne = jest
        .fn()
        .mockImplementation(() => ({ exec: () => Promise.resolve(current) }));
      static findOneAndUpdate = jest.fn<
        unknown,
        [
          unknown,
          { $set: Record<string, unknown>; $unset?: Record<string, number> },
        ]
      >();
    }
    update = TransactionModel.findOneAndUpdate;
    update.mockReturnValue({ exec: () => Promise.resolve({ _id: id }) });
    items = {
      findOne: jest.fn<unknown, [Record<string, unknown>]>().mockReturnValue({
        exec: () => Promise.resolve(item),
      }),
    };
    budgets = {
      findOne: jest
        .fn<unknown, [Record<string, unknown>]>()
        .mockReturnValue({ exec: () => Promise.resolve(budget) }),
    };
    service = new TransactionsService(
      TransactionModel as unknown as Model<TransactionDocument>,
      budgets as unknown as Model<BudgetDocument>,
      items as unknown as Model<BudgetItemDocument>,
    );
  });

  it('accepts the frontend payload and creates an unassigned needs-review transaction', async () => {
    const dto = plainToInstance(CreateTransactionDto, payload);
    expect(await validate(dto)).toEqual([]);
    await service.create(userId, dto);
    expect(saved.matchingStatus).toBe('needs_review');
    expect(saved.budgetItemId).toBeUndefined();
  });

  it('creates an explicit manual assignment and scopes reference checks to the owner', async () => {
    await service.create(
      userId,
      plainToInstance(CreateTransactionDto, {
        ...payload,
        budgetItemId: itemId,
      }),
    );
    expect(saved).toMatchObject({
      matchingStatus: 'manual',
      matchingSource: 'manual',
    });
    expect(String(saved.budgetItemId)).toBe(itemId);
    expect(items.findOne.mock.calls[0][0]).toMatchObject({
      userId: new Types.ObjectId(userId),
      isDeleted: false,
    });
    expect(budgets.findOne.mock.calls[0][0]).toMatchObject({
      userId: new Types.ObjectId(userId),
      isDeleted: false,
    });
  });

  it('updates the item and manual metadata atomically, clearing stale confidence', async () => {
    await service.update(id, userId, { budgetItemId: itemId });
    expect(update.mock.calls[0][1]).toEqual({
      $set: {
        budgetItemId: new Types.ObjectId(itemId),
        matchingStatus: 'manual',
        matchingSource: 'manual',
      },
      $unset: { matchingConfidence: 1 },
    });
    const matcher = new BudgetMatchingService(
      new MerchantNormalizationService(),
    );
    const transaction = {
      budgetItemId: new Types.ObjectId(itemId),
      matchingStatus: 'manual' as const,
      matchingSource: 'manual' as const,
      userId: new Types.ObjectId(userId),
      date: new Date(),
      name: 'Synthetic',
      type: 'expense',
    };
    expect(
      matcher.matchTransaction(transaction, {
        userId: new Types.ObjectId(userId),
        budgets: [],
        items: [],
      }),
    ).toBe(transaction);
    expect(String(transaction.budgetItemId)).toBe(itemId);
  });

  it('clears assignment and all stale metadata with null', async () => {
    await service.update(id, userId, { budgetItemId: null });
    expect(update.mock.calls[0][1]).toEqual({
      $set: { matchingStatus: 'needs_review' },
      $unset: { matchingConfidence: 1, budgetItemId: 1, matchingSource: 1 },
    });
  });

  it.each([
    { budgetItemId: itemId, matchingStatus: 'needs_review' as const },
    { budgetItemId: null, matchingSource: 'manual' as const },
    { matchingStatus: 'manual' as const },
    { budgetItemId: itemId, matchingConfidence: 1 },
  ])('rejects inconsistent metadata %j', async (dto) => {
    await expect(service.update(id, userId, dto)).rejects.toThrow(
      BadRequestException,
    );
    expect(update).not.toHaveBeenCalled();
  });

  it('rejects unavailable or foreign references', async () => {
    budgets.findOne.mockReturnValue({ exec: () => Promise.resolve(null) });
    await expect(
      service.update(id, userId, { budgetItemId: itemId }),
    ).rejects.toThrow(BadRequestException);
    expect(update).not.toHaveBeenCalled();
  });

  it('leaves assignment metadata untouched for ordinary edits', async () => {
    await service.update(id, userId, { name: 'Corrected synthetic purchase' });
    expect(update.mock.calls[0][1]).toEqual({
      $set: { name: 'Corrected synthetic purchase' },
    });
  });

  it('stores account and budget item references as ObjectIds when updating', async () => {
    const accountId = new Types.ObjectId().toString();
    await service.update(id, userId, { accountId, budgetItemId: itemId });
    expect(update).toHaveBeenCalledWith(
      {
        _id: new Types.ObjectId(id),
        userId: new Types.ObjectId(userId),
        date: current.date,
        type: current.type,
        budgetItemId: current.budgetItemId,
      },
      {
        $set: {
          accountId: new Types.ObjectId(accountId),
          budgetItemId: new Types.ObjectId(itemId),
          matchingStatus: 'manual',
          matchingSource: 'manual',
        },
        $unset: { matchingConfidence: 1 },
      },
      { new: true, runValidators: true },
    );
  });

  describe('eligibility', () => {
    it.each(['create', 'update'] as const)(
      '%s hides foreign, deleted and nonexistent item/parent references',
      async (operation) => {
        for (const target of ['item', 'budget']) {
          for (const reason of ['foreign', 'deleted', 'missing']) {
            const model = target === 'item' ? items : budgets;
            const document = target === 'item' ? item : budget;
            const candidate = {
              ...document,
              userId: new Types.ObjectId(
                reason === 'foreign' ? undefined : userId,
              ),
              isDeleted: reason === 'deleted',
            };
            model.findOne.mockImplementation((query) => ({
              exec: () =>
                Promise.resolve(
                  reason !== 'missing' &&
                    String(query.userId) === String(candidate.userId) &&
                    query.isDeleted === candidate.isDeleted
                    ? candidate
                    : null,
                ),
            }));
            const request =
              operation === 'create'
                ? service.create(
                    userId,
                    plainToInstance(CreateTransactionDto, {
                      ...payload,
                      budgetItemId: itemId,
                    }),
                  )
                : service.update(id, userId, { budgetItemId: itemId });
            await expect(request).rejects.toThrow(
              'Budget item is unavailable; choose another item',
            );
            expect(saved).toEqual({});
            expect(update).not.toHaveBeenCalled();
          }
          modelReset();
        }
        function modelReset() {
          items.findOne.mockReturnValue({ exec: () => Promise.resolve(item) });
          budgets.findOne.mockReturnValue({
            exec: () => Promise.resolve(budget),
          });
        }
      },
    );

    it.each(['create', 'update'] as const)(
      '%s rejects every ineligible reference before writing',
      async (operation) => {
        const eligibleItem = item;
        const eligibleBudget = budget;
        const cases = [
          {
            item: null,
            budget: eligibleBudget,
            message: 'Budget item is unavailable',
          },
          {
            item: eligibleItem,
            budget: null,
            message: 'Budget item is unavailable',
          },
          ...['draft', 'closed'].map((status) => ({
            item: eligibleItem,
            budget: { ...eligibleBudget, status },
            message: 'Budget must be active',
          })),
          {
            item: { ...eligibleItem, type: 'income' },
            budget: eligibleBudget,
            message: 'Budget item type must match',
          },
          {
            item: eligibleItem,
            budget: { ...eligibleBudget, startDate: new Date('2026-11-02') },
            message: 'Transaction date must be within',
          },
          {
            item: eligibleItem,
            budget: { ...eligibleBudget, endDate: new Date('2026-10-31') },
            message: 'Transaction date must be within',
          },
        ];
        for (const scenario of cases) {
          item = scenario.item;
          budget = scenario.budget;
          const request =
            operation === 'create'
              ? service.create(
                  userId,
                  plainToInstance(CreateTransactionDto, {
                    ...payload,
                    budgetItemId: itemId,
                  }),
                )
              : service.update(id, userId, { budgetItemId: itemId });
          await expect(request).rejects.toThrow(scenario.message);
          expect(saved).toEqual({});
          expect(update).not.toHaveBeenCalled();
        }
      },
    );

    it.each(['type', 'date'] as const)(
      'rejects incompatible retained-assignment %s edits without writes',
      async (field) => {
        const before = { ...current };
        await expect(
          service.update(
            id,
            userId,
            field === 'type'
              ? { type: 'income' }
              : { date: new Date('2026-12-01') },
          ),
        ).rejects.toThrow(BadRequestException);
        expect(current).toEqual(before);
        expect(update).not.toHaveBeenCalled();
      },
    );

    it('validates the resulting date and type when reassigning', async () => {
      item = { ...item, type: 'income' };
      await service.update(id, userId, {
        budgetItemId: itemId,
        type: 'income',
        date: new Date('2026-11-15'),
      });
      expect(update).toHaveBeenCalled();
    });

    it.each(['2026-11-01T00:00:00Z', '2026-11-30T00:00:00Z'])(
      'preserves metadata for valid edits at inclusive bound %s',
      async (date) => {
        await service.update(id, userId, { date: new Date(date) });
        expect(update.mock.calls[0][1]).toEqual({
          $set: { date: new Date(date) },
        });
      },
    );

    it('allows clearing together with an incompatible date/type change', async () => {
      await service.update(id, userId, {
        budgetItemId: null,
        type: 'income',
        date: new Date('2027-01-01'),
      });
      expect(items.findOne).not.toHaveBeenCalled();
      expect(update.mock.calls[0][1].$unset).toMatchObject({
        budgetItemId: 1,
        matchingSource: 1,
        matchingConfidence: 1,
      });
    });

    it('allows unassigned date/type edits', async () => {
      delete current.budgetItemId;
      await service.update(id, userId, { type: 'income' });
      expect(items.findOne).not.toHaveBeenCalled();
      expect(update.mock.calls[0][1]).toEqual({ $set: { type: 'income' } });
    });

    it('rejects a stale transaction snapshot instead of writing against unvalidated values', async () => {
      update.mockReturnValue({ exec: () => Promise.resolve(null) });
      await expect(
        service.update(id, userId, { type: 'expense' }),
      ).rejects.toThrow('reload and retry');
      expect(update.mock.calls[0][0]).toMatchObject({
        date: current.date,
        type: current.type,
        budgetItemId: current.budgetItemId,
      });
    });
  });
});
