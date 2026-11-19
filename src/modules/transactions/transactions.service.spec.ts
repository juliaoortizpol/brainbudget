import { ClosedPeriodHistoryService } from '../reports/closed-period-history.service';
import { coverageTestConnection } from '../../../test/coverage-test-support';
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
  type ReferenceQuery = [
    Record<string, unknown>,
    unknown?,
    { session?: unknown }?,
  ];
  let items: {
    findOne: jest.Mock<unknown, ReferenceQuery>;
    updateOne: jest.Mock;
  };
  let budgets: { findOne: jest.Mock<unknown, ReferenceQuery> };
  let service: TransactionsService;
  let history: {
    links: jest.Mock;
    isCovered: jest.Mock;
    record: jest.Mock;
    protectDeletion: jest.Mock;
    transactionIdsWithExceptions: jest.Mock;
  };
  let connection: ReturnType<typeof coverageTestConnection>;
  let remove: jest.Mock;
  let current: Record<string, unknown>;
  let item: Record<string, unknown> | null;
  let budget: Record<string, unknown> | null;

  function query(value: unknown) {
    const result = { exec: () => Promise.resolve(value), lean: () => result };
    return result;
  }

  beforeEach(() => {
    saved = {};
    current = {
      currency: 'DOP',
      ...payload,
      date: new Date(payload.date),
      budgetItemId: new Types.ObjectId(itemId),
    };
    item = { budgetId: new Types.ObjectId(), type: 'expense' };
    budget = {
      currencyContext: {
        version: 1,
        currency: 'DOP',
        origin: 'dop-v1-planning',
      },

      status: 'active',
      coverageVersion: 1,
      timezone: 'UTC',
      startDate: new Date('2026-11-01T00:00:00Z'),
      endDate: new Date('2026-11-30T00:00:00Z'),
    };
    connection = coverageTestConnection();
    remove = jest
      .fn()
      .mockReturnValue({ exec: () => Promise.resolve({ _id: id }) });
    class TransactionModel {
      static db = connection;
      static findOneAndDelete = remove;
      static hydrate = (row: unknown) => row;
      constructor(data: Record<string, unknown>) {
        saved = data;
      }
      save() {
        return Promise.resolve({ ...saved, _id: new Types.ObjectId(id) });
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
      findOne: jest
        .fn<unknown, ReferenceQuery>()
        .mockImplementation((filter) =>
          query(filter.isDeleted === false && item?.isDeleted ? null : item),
        ),
      updateOne: jest.fn(),
    };
    budgets = {
      findOne: jest
        .fn<unknown, ReferenceQuery>()
        .mockImplementation((filter) =>
          query(
            (filter.status && budget?.status !== filter.status) ||
              (filter.isDeleted === false && budget?.isDeleted)
              ? null
              : budget,
          ),
        ),
    };
    history = {
      links: jest.fn().mockResolvedValue([]),
      isCovered: jest.fn().mockReturnValue(false),
      record: jest.fn().mockResolvedValue(undefined),
      protectDeletion: jest.fn().mockResolvedValue(undefined),
      transactionIdsWithExceptions: jest.fn().mockResolvedValue(new Set()),
    };
    service = new TransactionsService(
      TransactionModel as unknown as Model<TransactionDocument>,
      budgets as unknown as Model<BudgetDocument>,
      items as unknown as Model<BudgetItemDocument>,
      history as unknown as ClosedPeriodHistoryService,
    );
  });

  it('TC4/TC9 retains a manual create targeting an item whose period finalized first', async () => {
    const reportBudget = item?.budgetId;
    budget = { ...budget, status: 'closed', _id: reportBudget };
    history.links.mockResolvedValue([{ budgetId: reportBudget }]);
    history.isCovered.mockReturnValue(true);
    const dto = plainToInstance(CreateTransactionDto, {
      ...payload,
      budgetItemId: itemId,
    });
    await service.create(userId, dto);
    expect(saved).toMatchObject({
      matchingStatus: 'needs_review',
      budgetItemId: undefined,
    });
    expect(history.links).toHaveBeenCalledWith(
      new Types.ObjectId(userId),
      [new Date(dto.date)],
      connection.session,
    );
    expect(connection.lock.mock.invocationCallOrder[0]).toBeLessThan(
      history.links.mock.invocationCallOrder[0],
    );
    expect(history.record).toHaveBeenCalledWith(
      new Types.ObjectId(userId),
      new Types.ObjectId(id),
      [{ budgetId: reportBudget }],
      null,
      { ...saved, _id: new Types.ObjectId(id) },
      connection.session,
    );
  });

  it('TC4 rejects assignment of a covered purchase after finalization without any write', async () => {
    history.isCovered.mockReturnValue(true);
    await expect(
      service.update(id, userId, { budgetItemId: itemId }),
    ).rejects.toMatchObject({ response: { code: 'closed_period_assignment' } });
    expect(update).not.toHaveBeenCalled();
  });

  it('TC10 permits a date and type correction on a retained closed item without changing its original association', async () => {
    const reportBudget = item?.budgetId;
    current.budgetItemId = itemId;
    budget = { ...budget, status: 'closed', _id: reportBudget };
    history.links.mockResolvedValue([
      { budgetId: reportBudget, includedTransactionIds: [id] },
    ]);
    const corrected = {
      type: 'income',
      date: new Date('2026-12-01T15:00:00Z'),
    };
    await service.update(id, userId, corrected);
    expect(update.mock.calls[0][1]).toEqual({ $set: corrected });
    expect(update.mock.calls[0][0]).toMatchObject({
      $expr: {
        $and: [
          {
            $eq: [
              { $ifNull: ['$currency', null] },
              { $literal: current.currency },
            ],
          },
          { $eq: [{ $ifNull: ['$budgetItemId', null] }, { $literal: itemId }] },
        ],
      },
    });
    expect(history.record).toHaveBeenCalledTimes(1);
  });

  it('TC10 aborts the transaction when writing a correction exception fails', async () => {
    let committed = false;
    connection.session.withTransaction.mockImplementation(
      async (work: () => Promise<unknown>) => {
        const result = await work();
        committed = true;
        return result;
      },
    );
    history.record.mockRejectedValue(
      new Error('Injected exception save failure'),
    );
    await expect(service.update(id, userId, { amount: 20 })).rejects.toThrow(
      'transactional database required',
    );
    expect(update).toHaveBeenCalledTimes(1);
    expect(history.record).toHaveBeenCalledWith(
      new Types.ObjectId(userId),
      new Types.ObjectId(id),
      [],
      current,
      { _id: id },
      connection.session,
    );
    expect(committed).toBe(false);
  });

  it('TC10 checks history under the owner lock before deletion and keeps ordinary deletion', async () => {
    history.protectDeletion.mockRejectedValueOnce(
      new BadRequestException('Report evidence is retained'),
    );
    await expect(service.remove(id, userId)).rejects.toThrow(
      'Report evidence is retained',
    );
    expect(remove).not.toHaveBeenCalled();
    await expect(service.remove(id, userId)).resolves.toBeUndefined();
    expect(remove).toHaveBeenCalledWith(
      { _id: new Types.ObjectId(id), userId: new Types.ObjectId(userId) },
      { session: connection.session },
    );
    expect(history.protectDeletion.mock.invocationCallOrder[1]).toBeLessThan(
      remove.mock.invocationCallOrder[0],
    );
  });

  describe('BE5-R2 legacy closed history (TC5/TC10/TC11)', () => {
    beforeEach(() => {
      budget = { _id: item?.budgetId, status: 'closed' };
    });

    it.each([false, true])(
      'blocks physical deletion for retained references (retired: %s)',
      async (retired) => {
        item = { ...item, isDeleted: retired };
        budget = { ...budget, isDeleted: retired };
        current.budgetItemId = itemId.toUpperCase();
        await expect(service.remove(id, userId)).rejects.toMatchObject({
          status: 409,
          response: { code: 'legacy_closed_transaction_retained' },
        });
        const owner = new Types.ObjectId(userId);
        expect(items.findOne).toHaveBeenCalledWith(
          { _id: new Types.ObjectId(itemId), userId: owner },
          { budgetId: 1 },
          { session: connection.session },
        );
        expect(budgets.findOne).toHaveBeenCalledWith(
          { _id: item.budgetId, userId: owner, status: 'closed' },
          { _id: 1 },
          { session: connection.session },
        );
        expect(connection.lock.mock.invocationCallOrder[0]).toBeLessThan(
          items.findOne.mock.invocationCallOrder[0],
        );
        expect(remove).not.toHaveBeenCalled();
      },
    );

    it.each([
      { budgetItemId: null },
      { budgetItemId: itemId, rememberMerchant: true, merchantKeyword: 'Shop' },
      { amount: 20 },
      { type: 'income', date: new Date('2026-12-01') },
      { rawDescription: 'Changed', normalizedMerchant: 'Changed' },
      { accountId: new Types.ObjectId().toString(), notes: 'Changed' },
      { currency: 'DOP' },
    ])('preserves the only legacy evidence on PATCH %j', async (dto) => {
      delete current.currency;
      item = { ...item, isDeleted: true };
      budget = { ...budget, isDeleted: true };
      // Another period cannot audit the original association.
      history.links.mockResolvedValue([{ budgetId: new Types.ObjectId() }]);
      await expect(service.update(id, userId, dto)).rejects.toMatchObject({
        status: 409,
        response: { code: 'legacy_closed_transaction_retained' },
      });
      expect(update).not.toHaveBeenCalled();
      expect(items.updateOne).not.toHaveBeenCalled();
      expect(history.record).not.toHaveBeenCalled();
    });

    it.each(['item', 'parent'] as const)(
      'keeps ordinary deletion when the %s belongs to another owner',
      async (foreign) => {
        const model = foreign === 'item' ? items : budgets;
        const foreignOwner = new Types.ObjectId();
        model.findOne.mockImplementation((filter) =>
          query(foreignOwner.equals(String(filter.userId)) ? budget : null),
        );
        await expect(service.remove(id, userId)).resolves.toBeUndefined();
        expect(remove).toHaveBeenCalledTimes(1);
      },
    );

    it('allows V1 clearing with original assignment evidence in the same audit session', async () => {
      const links = [
        { budgetId: item?.budgetId, includedTransactionIds: [id] },
      ];
      history.links.mockResolvedValue(links);
      const after = { ...current, budgetItemId: undefined };
      update.mockReturnValue(query(after));
      await expect(
        service.update(id, userId, { budgetItemId: null }),
      ).resolves.toBe(after);
      expect(update.mock.calls[0][1].$unset).toHaveProperty('budgetItemId', 1);
      expect(history.record).toHaveBeenCalledWith(
        new Types.ObjectId(userId),
        new Types.ObjectId(id),
        links,
        current,
        after,
        connection.session,
      );
    });
  });

  it('accepts the frontend payload and creates an unassigned needs-review transaction', async () => {
    const dto = plainToInstance(CreateTransactionDto, payload);
    expect(await validate(dto)).toEqual([]);
    await service.create(userId, dto);
    expect(saved.matchingStatus).toBe('needs_review');
    expect(saved.budgetItemId).toBeUndefined();
    expect(saved).toMatchObject({
      currency: 'DOP',
      currencyOrigin: 'manual-default',
      currencyContextVersion: 1,
    });
  });

  it.each(['DOP', 'USD'])(
    'TC1 preserves explicit %s on unassigned creation',
    async (currency) => {
      await service.create(
        userId,
        plainToInstance(CreateTransactionDto, { ...payload, currency }),
      );
      expect(saved).toMatchObject({
        currency,
        currencyOrigin: 'explicit',
        currencyContextVersion: 1,
      });
    },
  );

  it.each(['USD', undefined, 'invalid'])(
    'TC3 rejects %s assignment before any write or learning',
    async (currency) => {
      current.currency = currency;
      const before = { ...current };
      await expect(
        service.update(id, userId, { budgetItemId: itemId }),
      ).rejects.toThrow(/currency|DOP/);
      expect(update).not.toHaveBeenCalled();
      expect(current).toEqual(before);
    },
  );

  it('TC2 protects known currency even when clearing the item and allows unknown-to-USD with explicit clearing', async () => {
    await expect(
      service.update(id, userId, { currency: 'USD', budgetItemId: null }),
    ).rejects.toMatchObject({ response: { code: 'purchase_currency_locked' } });
    expect(update).not.toHaveBeenCalled();

    delete current.currency;
    await expect(
      service.update(id, userId, { currency: 'USD' }),
    ).rejects.toThrow('Only DOP');
    expect(update).not.toHaveBeenCalled();
    await service.update(id, userId, { currency: 'USD', budgetItemId: null });
    expect(update.mock.calls[0][1]).toMatchObject({
      $set: { currency: 'USD', currencyOrigin: 'explicit-resolution' },
      $unset: { budgetItemId: 1 },
    });
  });

  it('TC5 ordinary legacy edits do not add a currency; explicit correction enables assignment', async () => {
    delete current.currency;
    await service.update(id, userId, { notes: 'Synthetic legacy note' });
    expect(update.mock.calls[0][1]).toEqual({
      $set: { notes: 'Synthetic legacy note' },
    });
    await service.update(id, userId, { currency: 'DOP', budgetItemId: itemId });
    expect(update.mock.calls[1][1]).toMatchObject({
      $set: {
        currency: 'DOP',
        currencyOrigin: 'explicit-resolution',
        matchingStatus: 'manual',
      },
    });
    expect(current.currency).toBeUndefined();
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
    budgets.findOne.mockReturnValue(query(null));
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
        $expr: {
          $and: [
            {
              $eq: [
                { $ifNull: ['$currency', null] },
                { $literal: current.currency },
              ],
            },
            {
              $eq: [
                { $ifNull: ['$budgetItemId', null] },
                { $literal: current.budgetItemId },
              ],
            },
          ],
        },
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
      {
        new: true,
        runValidators: true,
        session: connection.session,
        lean: true,
      },
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
            model.findOne.mockImplementation((filter) =>
              query(
                reason !== 'missing' &&
                  String(filter.userId) === String(candidate.userId) &&
                  (filter.isDeleted === undefined ||
                    filter.isDeleted === candidate.isDeleted)
                  ? candidate
                  : null,
              ),
            );
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
          items.findOne.mockImplementation(() => query(item));
          budgets.findOne.mockImplementation((filter) =>
            query(
              filter.status && budget?.status !== filter.status ? null : budget,
            ),
          );
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
            budget: { ...eligibleBudget, startDate: new Date('2026-11-03') },
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
              : { date: new Date('2026-10-31') },
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

    it('accepts December assignments and date edits after the November planned end', async () => {
      await service.create(
        userId,
        plainToInstance(CreateTransactionDto, {
          ...payload,
          date: '2026-12-12T12:00:00Z',
          budgetItemId: itemId,
        }),
      );
      expect(saved.matchingStatus).toBe('manual');
      await service.update(id, userId, {
        date: new Date('2026-12-12T12:00:00Z'),
      });
      expect(update.mock.calls[0][1].$set.date).toEqual(
        new Date('2026-12-12T12:00:00Z'),
      );
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
      expect(items.findOne).toHaveBeenCalledTimes(1);
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
        $expr: {
          $and: [
            {
              $eq: [
                { $ifNull: ['$currency', null] },
                { $literal: current.currency },
              ],
            },
            {
              $eq: [
                { $ifNull: ['$budgetItemId', null] },
                { $literal: current.budgetItemId },
              ],
            },
          ],
        },
      });
    });
  });
});
