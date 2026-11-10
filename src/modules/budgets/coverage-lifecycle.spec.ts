import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { Types } from 'mongoose';
import { BudgetsService } from './budgets.service';
import { CreateBudgetDto } from './dto/create-budget.dto';
import { UpdateBudgetDto } from './dto/update-budget.dto';
import { coverageTestConnection } from '../../../test/coverage-test-support';
import { BudgetMatchingService } from './budget-matching.service';
import { MerchantNormalizationService } from '../transactions/merchant-normalization.service';
import { BudgetMatchingContext } from './budget-matching-context.service';

describe('coverage lifecycle (controlled persistence)', () => {
  const owner = new Types.ObjectId();
  const id = new Types.ObjectId();
  const itemId = new Types.ObjectId();
  const now = new Date('2025-01-04T12:34:56.789Z');
  const base = {
    _id: id,
    userId: owner,
    name: 'Synthetic November',
    periodType: 'monthly',
    startDate: new Date('2024-11-01T04:00:00Z'),
    plannedEndDate: new Date('2024-12-01T04:00:00Z'),
    endDate: new Date('2024-12-01T04:00:00Z'),
    timezone: 'America/La_Paz',
    coverageVersion: 1,
    status: 'active',
  };
  let current: Record<string, unknown>;
  let others: Record<string, unknown>[];
  let outside: Record<string, unknown>[];
  let written: jest.Mock<
    unknown,
    [unknown, { $set: { actualCutoffDate: Date } }, unknown]
  >;
  let created: jest.Mock;
  let aggregate: jest.Mock;
  let connection: ReturnType<typeof coverageTestConnection>;
  let service: BudgetsService;
  const query = (value: unknown) => ({
    exec: () => Promise.resolve(value),
    limit: () => query(value),
  });
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(now);
    current = { ...base };
    others = [];
    outside = [];
    connection = coverageTestConnection();
    written = jest.fn<
      unknown,
      [unknown, { $set: { actualCutoffDate: Date } }, unknown]
    >(() => query({ matchedCount: 1 }));
    created = jest.fn().mockResolvedValue({ _id: id });
    aggregate = jest
      .fn()
      .mockResolvedValue([{ _id: itemId, totalSpent: 10.125 }]);
    class Budgets {
      static db = connection;
      static findOne = jest.fn(() => query(current));
      static find = jest.fn(() => query(others));
      static updateOne = written;
      constructor(data: unknown) {
        created(data);
      }
      save = () => Promise.resolve({ _id: id });
    }
    service = new BudgetsService(
      Budgets as never,
      { find: () => query([{ _id: itemId }]) } as never,
      { find: () => query(outside), aggregate } as never,
    );
    jest.spyOn(service, 'findOne').mockResolvedValue({} as never);
  });
  afterEach(() => jest.useRealTimers());

  it('defaults close to the confirmed instant and preserves history without any transaction/item mutation', async () => {
    await service.update(String(id), String(owner), { status: 'closed' });
    expect(written).toHaveBeenCalledWith(
      expect.objectContaining({ userId: owner, isDeleted: false }),
      {
        $set: expect.objectContaining({
          status: 'closed',
          actualCutoffDate: now,
          closedAt: now,
          timezone: base.timezone,
          startDate: base.startDate,
        }) as unknown,
      },
      { session: connection.session, runValidators: true },
    );
    expect(connection.lock).toHaveBeenCalledTimes(1);
    expect(connection.lock.mock.invocationCallOrder[0]).toBeLessThan(
      written.mock.invocationCallOrder[0],
    );
  });
  it('closes a whole completed local day at next local midnight', async () => {
    await service.update(String(id), String(owner), {
      status: 'closed',
      closeThroughDate: '2024-12-31',
    });
    expect(
      (written.mock.calls[0][1] as { $set: { actualCutoffDate: Date } }).$set
        .actualCutoffDate,
    ).toEqual(new Date('2025-01-01T04:00:00Z'));
  });
  it.each([
    { status: 'closed', actualCutoffDate: '2025-01-05T00:00:00Z' },
    { status: 'closed', closeThroughDate: '2025-01-04' },
    { status: 'closed', closeThroughDate: '2024-02-30' },
    {
      status: 'closed',
      closeThroughDate: '2024-12-01',
      actualCutoffDate: '2024-12-02T04:00:00Z',
    },
    { status: 'closed', actualCutoffDate: '2024-11-01T04:00:00Z' },
    { actualCutoffDate: '2024-12-01T04:00:00Z' },
    { status: 'draft' },
    { timezone: 'UTC' },
  ])('rejects invalid lifecycle request %j before writes', async (dto) => {
    await expect(
      service.update(String(id), String(owner), dto),
    ).rejects.toThrow(BadRequestException);
    expect(written).not.toHaveBeenCalled();
  });
  it('rejects stranding at the exclusive cutoff with only safe actionable details', async () => {
    const transactionId = new Types.ObjectId();
    outside = [
      {
        _id: transactionId,
        date: new Date('2024-12-15T12:00:00Z'),
        budgetItemId: itemId,
        name: 'Must not appear',
        amount: 999,
      },
    ];
    try {
      await service.update(String(id), String(owner), {
        status: 'closed',
        actualCutoffDate: '2024-12-15T12:00:00Z',
      });
      throw new Error('Expected cutoff rejection');
    } catch (error) {
      expect((error as BadRequestException).getResponse()).toEqual({
        message: expect.stringContaining('Correct dates') as unknown,
        affectedTransactions: [
          {
            id: String(transactionId),
            date: outside[0].date,
            budgetItemId: String(itemId),
          },
        ],
        hasMore: false,
      });
    }
    expect(written).not.toHaveBeenCalled();
  });
  it('allows drafts alongside the active budget without replacing it', async () => {
    others = [{ ...base }];
    await service.create(String(owner), {
      name: 'Draft',
      periodType: 'custom',
      startDate: '2025-01-01T04:00:00Z',
      timezone: base.timezone,
      status: 'draft',
    });
    expect(created).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'draft',
        userId: owner,
        coverageVersion: 1,
      }),
    );
    expect(written).not.toHaveBeenCalled();
  });
  it('rejects a second active budget and closed overlaps, permits adjacency', async () => {
    const dto = {
      name: 'Next',
      periodType: 'custom',
      startDate: '2025-01-01T04:00:00Z',
      timezone: base.timezone,
      status: 'active',
    };
    others = [{ ...base }];
    await expect(service.create(String(owner), dto)).rejects.toThrow(
      'Only one active',
    );
    others = [
      {
        ...base,
        status: 'closed',
        actualCutoffDate: new Date('2025-01-01T04:00:00.001Z'),
      },
    ];
    await expect(service.create(String(owner), dto)).rejects.toThrow(
      'overlaps',
    );
    others = [
      { ...base, status: 'closed', actualCutoffDate: new Date(dto.startDate) },
    ];
    await expect(service.create(String(owner), dto)).resolves.toBeDefined();
  });
  it('prevents reopening closed budgets and changing legacy lifecycle without migration', async () => {
    current.status = 'closed';
    await expect(
      service.update(String(id), String(owner), { status: 'active' }),
    ).rejects.toThrow('cannot be changed or reopened');
    current = { ...base, coverageVersion: undefined };
    await expect(
      service.update(String(id), String(owner), { status: 'closed' }),
    ).rejects.toThrow('explicit migration');
    await expect(
      service.update(String(id), String(owner), {
        endDate: '2025-01-01T04:00:00Z',
      }),
    ).rejects.toThrow('explicit migration');
    expect(written).not.toHaveBeenCalled();
  });
  it('matches a December purchase after the planned November end without touching manual history', () => {
    const matcher = new BudgetMatchingService(
      new MerchantNormalizationService(),
    );
    const transaction = {
      userId: owner,
      date: new Date('2024-12-20T12:00:00Z'),
      name: 'Synthetic Shop',
      type: 'expense',
      budgetItemId: undefined as Types.ObjectId | undefined,
    };
    const context = {
      userId: owner,
      budgets: [base],
      items: [
        {
          _id: itemId,
          budgetId: id,
          userId: owner,
          type: 'expense',
          matchingRules: [
            {
              id: 'rule',
              field: 'merchant',
              operator: 'equals',
              value: 'Synthetic Shop',
              source: 'user',
            },
          ],
        },
      ],
    } as unknown as BudgetMatchingContext;
    expect(matcher.matchTransaction(transaction, context).budgetItemId).toEqual(
      itemId,
    );
    const manual = { ...transaction, matchingStatus: 'manual' as const };
    expect(matcher.matchTransaction(manual, { ...context, budgets: [] })).toBe(
      manual,
    );
  });
});

describe('coverage ValidationPipe contract', () => {
  const pipe = new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  it('keeps optional planning dates while accepting explicit timezone and arbitrary instants', async () => {
    await expect(
      pipe.transform(
        {
          name: 'Synthetic',
          periodType: 'custom',
          status: 'active',
          startDate: '2024-11-01T12:34:56Z',
          timezone: 'America/La_Paz',
        },
        { type: 'body', metatype: CreateBudgetDto },
      ),
    ).resolves.toMatchObject({ timezone: 'America/La_Paz' });
    await expect(
      pipe.transform(
        { status: 'closed', actualCutoffDate: '2024-12-02T12:34:56.789Z' },
        { type: 'body', metatype: UpdateBudgetDto },
      ),
    ).resolves.toMatchObject({ status: 'closed' });
  });
  it.each([
    { actualCutoffDate: null },
    { timezone: null },
    { startDate: null },
    { plannedEndDate: null },
    { closeThroughDate: 'tomorrow' },
    { closedAt: '2024-12-01' },
    { coverageVersion: 1 },
    { startDate: '2023-02-29T00:00:00Z' },
    { plannedEndDate: '2024-04-31T00:00:00Z' },
    { actualCutoffDate: '2023-02-29T12:00:00Z' },
  ])('rejects malformed or server-owned fields %j', async (body) => {
    await expect(
      pipe.transform(body, { type: 'body', metatype: UpdateBudgetDto }),
    ).rejects.toThrow();
  });
});
