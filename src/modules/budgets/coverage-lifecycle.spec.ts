import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { model, Types } from 'mongoose';
import { BudgetsService } from './budgets.service';
import { CreateBudgetDto } from './dto/create-budget.dto';
import { UpdateBudgetDto } from './dto/update-budget.dto';
import { coverageTestConnection } from '../../../test/coverage-test-support';
import { BudgetMatchingService } from './budget-matching.service';
import { MerchantNormalizationService } from '../transactions/merchant-normalization.service';
import { BudgetMatchingContext } from './budget-matching-context.service';
import { ClosePreviewDto, ConfirmCloseDto } from '../reports/close-budget.dto';
import { TransactionsService } from '../transactions/transactions.service';
import { TransactionMailPersistenceService } from '../transaction-mail-import/transaction-mail-persistence.service';
import { BudgetReportsService } from '../reports/budget-reports.service';
import { BudgetPeriodReportSchema } from '../reports/schemas/budget-period-report.schema';

describe('coverage lifecycle (controlled persistence)', () => {
  const owner = new Types.ObjectId();
  const id = new Types.ObjectId();
  const itemId = new Types.ObjectId();
  const incomeId = new Types.ObjectId();
  const now = new Date('2025-01-04T12:34:56.789Z');
  const base = {
    currencyContext: { version: 1, currency: 'DOP', origin: 'dop-v1-planning' },

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
  let currencyRows: Record<string, unknown>[];
  let written: jest.Mock<
    unknown,
    [unknown, { $set: { actualCutoffDate: Date } }, unknown]
  >;
  let created: jest.Mock;
  let aggregate: jest.Mock;
  let connection: ReturnType<typeof coverageTestConnection>;
  let service: BudgetsService;
  let reports: BudgetReportsService;
  let saved: jest.Mock<void, [unknown, unknown]>;
  let priorReport: unknown;
  const Report = model('ControlledCloseReport', BudgetPeriodReportSchema);
  const query = (value: unknown) => ({
    exec: () => Promise.resolve(value),
    limit: () => query(value),
    lean: () => query(value),
    sort: () => query(value),
  });
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(now);
    current = { ...base };
    others = [];
    outside = [];
    currencyRows = [];
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
      {
        find: (filter: { currency?: unknown }) =>
          query(filter.currency ? currencyRows : outside),
        aggregate,
      } as never,
    );
    saved = jest.fn<void, [unknown, unknown]>();
    priorReport = null;
    class Reports {
      static findOne = () => query(priorReport);
      constructor(private readonly detail: unknown) {}
      save = async (options: unknown) => {
        saved(this.detail, options);
        const report = new Report(this.detail);
        await report.validate();
        return report;
      };
    }
    reports = new BudgetReportsService(
      Budgets as never,
      {
        find: () =>
          query([
            {
              _id: itemId,
              isDeleted: false,
              name: 'Test item',
              type: 'expense',
              plannedAmount: 30,
            },
            {
              _id: incomeId,
              isDeleted: false,
              name: 'Synthetic income',
              type: 'income',
              plannedAmount: 5.125,
            },
          ]),
      } as never,
      { find: () => query([...currencyRows, ...outside]) } as never,
      Reports as never,
    );
    jest.spyOn(service, 'findOne').mockResolvedValue({} as never);
  });
  afterEach(() => jest.useRealTimers());

  it.each([
    { original: 'USD', origin: 'mail-parser', requested: 'DOP', blocked: true },
    {
      original: 'DOP',
      origin: 'mail-parser',
      requested: 'DOP',
      blocked: false,
    },
    {
      original: undefined,
      origin: undefined,
      requested: 'DOP',
      blocked: false,
    },
  ])(
    'TC2/TC6 preserves currency evidence when updating $original to $requested and assigning an item',
    async ({ original, origin, requested, blocked }) => {
      const transactionId = new Types.ObjectId();
      outside = [
        {
          _id: transactionId,
          date: new Date('2024-12-02T00:00:00Z'),
          type: 'expense',
          name: 'Synthetic Gmail purchase',
          source: 'gmail',
          amount: 20,
          currency: original,
          currencyOrigin: origin,
          currencyContextVersion: origin ? 1 : undefined,
        },
      ];
      const write = jest.fn((_filter: unknown, update: { $set: object }) => {
        outside = [{ ...outside[0], ...update.$set }];
        return query(outside[0]);
      });
      const record = jest.fn().mockResolvedValue(undefined);
      const transactions = new TransactionsService(
        {
          db: connection,
          findOne: () => query(outside[0]),
          findOneAndUpdate: write,
          hydrate: (row: unknown) => row,
        } as never,
        { findOne: () => query(current) } as never,
        {
          findOne: () => query({ _id: itemId, budgetId: id, type: 'expense' }),
        } as never,
        {
          links: () => Promise.resolve([]),
          isCovered: () => false,
          record,
        } as never,
      );
      const before = await reports.preview(String(id), String(owner), {});
      const mutation = transactions.update(
        String(transactionId),
        String(owner),
        {
          currency: requested,
          budgetItemId: String(itemId),
        },
      );
      if (blocked) {
        await expect(mutation).rejects.toMatchObject({
          response: { code: 'purchase_currency_locked' },
        });
        expect(write).not.toHaveBeenCalled();
        expect(record).not.toHaveBeenCalled();
        expect(outside[0]).toMatchObject({
          currency: original,
          currencyOrigin: origin,
          amount: 20,
        });
        expect(outside[0]).not.toHaveProperty('budgetItemId');
      } else {
        await expect(mutation).resolves.toMatchObject({
          currency: 'DOP',
          currencyOrigin: origin ?? 'explicit-resolution',
          budgetItemId: itemId,
        });
      }
      const fresh = await reports.preview(String(id), String(owner), {});
      expect(fresh.includedTransactionIds).toEqual([String(transactionId)]);
      const confirm = (previewToken: string) =>
        reports.confirm(String(id), String(owner), {
          confirmed: true,
          previewToken,
          actualCutoffDate: now.toISOString(),
        });
      if (blocked) {
        expect(fresh.blockers.map(({ code }) => code)).toEqual([
          'unsupported_currency',
          'unassigned',
        ]);
        expect(fresh.previewToken).toBe(before.previewToken);
        await expect(confirm(fresh.previewToken)).rejects.toMatchObject({
          response: { code: 'close_blocked' },
        });
        expect(saved).not.toHaveBeenCalled();
        expect(written).not.toHaveBeenCalled();
      } else {
        await expect(confirm(before.previewToken)).rejects.toMatchObject({
          response: { code: 'stale_close_preview' },
        });
        expect(fresh.blockers).toEqual([]);
        await expect(confirm(fresh.previewToken)).resolves.toHaveProperty(
          'reportId',
        );
        expect(saved).toHaveBeenCalledTimes(1);
        const [snapshot, options] = saved.mock.calls[0];
        expect(snapshot).toMatchObject({
          totals: { totalActualExpense: 20 },
          currencyContext: {
            transactions: [
              {
                transactionId: String(transactionId),
                budgetItemId: String(itemId),
                currency: 'DOP',
                version: 1,
                origin: origin ?? 'explicit-resolution',
              },
            ],
          },
        });
        expect(options).toEqual({ session: connection.session });
      }
    },
  );

  it.each(['USD', undefined])(
    'TC2/TC5 blocks closure for owned %s purchase evidence without writes',
    async (currency) => {
      currencyRows = [
        {
          _id: new Types.ObjectId(),
          budgetItemId: itemId,
          currency,
          amount: 10,
          date: base.startDate,
          type: 'income',
        },
      ];
      const preview = await reports.preview(String(id), String(owner), {});
      expect(preview.includedTransactionIds).toEqual([
        String(currencyRows[0]._id),
      ]);
      expect(preview.blockers.map(({ code }) => code)).toEqual([
        currency ? 'unsupported_currency' : 'unknown_currency',
        'assignment_type_conflict',
      ]);
      await expect(
        reports.confirm(String(id), String(owner), {
          confirmed: true,
          previewToken: preview.previewToken,
          actualCutoffDate: now.toISOString(),
        }),
      ).rejects.toThrow('Resolve preview blockers');
      expect(written).not.toHaveBeenCalled();
      expect(saved).not.toHaveBeenCalled();
    },
  );

  it('TC5 requires explicit planning resolution without rewriting transactions', async () => {
    delete current.currencyContext;
    const preview = await reports.preview(String(id), String(owner), {});
    expect(preview.blockers).toEqual([{ code: 'resolve_planning_currency' }]);
    await service.update(String(id), String(owner), {
      currency: 'DOP',
    });
    expect(written).toHaveBeenCalledWith(
      expect.anything(),
      {
        $set: expect.objectContaining({
          currencyContext: {
            version: 1,
            currency: 'DOP',
            origin: 'explicit-resolution',
          },
        }) as unknown,
      },
      expect.anything(),
    );
  });

  it('defaults close to the confirmed instant and preserves history without any transaction/item mutation', async () => {
    const preview = await reports.preview(String(id), String(owner), {});
    expect(preview.actualCutoffDate).toEqual(now);
    expect(connection.lock).not.toHaveBeenCalled();
    await reports.confirm(String(id), String(owner), {
      confirmed: true,
      previewToken: preview.previewToken,
      actualCutoffDate: now.toISOString(),
    });
    expect(saved).toHaveBeenCalledWith(
      expect.objectContaining({
        budgetId: id,
        userId: owner,
        includedTransactionIds: [],
      }),
      { session: connection.session },
    );
    expect(written).toHaveBeenCalledWith(
      expect.objectContaining({ userId: owner, isDeleted: false }),
      {
        $set: expect.objectContaining({
          status: 'closed',
          actualCutoffDate: now,
          closedAt: now,
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
    const preview = await reports.preview(String(id), String(owner), {
      closeThroughDate: '2024-12-31',
    });
    expect(preview.actualCutoffDate).toEqual(new Date('2025-01-01T04:00:00Z'));
  });

  it('TC1/TC3/TC4/TC6 reconciles an extended-period row and requires a fresh explicit confirmation', async () => {
    const row = {
      _id: new Types.ObjectId(),
      date: new Date('2024-12-15T12:00:00Z'),
      budgetItemId: itemId,
      type: 'expense',
      currency: 'DOP',
      amount: -10.125,
      name: 'Synthetic purchase',
      currencyOrigin: 'mail-parser',
    };
    outside = [row];
    const preview = await reports.preview(String(id), String(owner), {});
    expect(preview.includedTransactionIds).toEqual([String(row._id)]);
    expect(preview.items[0]).toMatchObject({
      actualAmount: 10.13,
      variance: 19.87,
    });
    expect(preview.totals).toMatchObject({
      totalActualExpense: 10.13,
      totalVariance: 14.74,
    });
    const payload = {
      confirmed: true,
      actualCutoffDate: now.toISOString(),
      previewToken: preview.previewToken,
    };
    await expect(
      reports.confirm(String(id), String(owner), {
        ...payload,
        confirmed: false,
      }),
    ).rejects.toThrow('Explicit close confirmation');
    row.amount = -12;
    await expect(
      reports.confirm(String(id), String(owner), payload),
    ).rejects.toThrow('Coverage or source evidence changed');
    expect(saved).not.toHaveBeenCalled();
    expect(written).not.toHaveBeenCalled();
    const fresh = await reports.preview(String(id), String(owner), {});
    const confirmation = { ...payload, previewToken: fresh.previewToken };
    const result = await reports.confirm(
      String(id),
      String(owner),
      confirmation,
    );
    const [detail] = saved.mock.calls[0];
    const persisted = new Report(detail).toObject();
    expect(persisted).toMatchObject({
      items: [
        { categoryName: 'Test item', type: 'expense', actualAmount: 12 },
        { categoryName: 'Synthetic income', type: 'income', actualAmount: 0 },
      ],
      currencyContext: {
        transactions: [
          { transactionId: String(row._id), origin: 'mail-parser' },
        ],
      },
      transactions: [{ transactionId: String(row._id), amount: -12 }],
    });
    priorReport = { ...result, _id: result.reportId };
    await expect(
      reports.confirm(String(id), String(owner), confirmation),
    ).resolves.toEqual(result);
    expect(saved).toHaveBeenCalledTimes(1);
    expect(written).toHaveBeenCalledTimes(1);
  });

  it('TC1/TC6 reconciles signed income and absolute expenses in the same snapshot', async () => {
    outside = [
      {
        _id: new Types.ObjectId(),
        date: base.startDate,
        budgetItemId: itemId,
        type: 'expense',
        amount: -2.125,
        currency: 'DOP',
      },
      {
        _id: new Types.ObjectId(),
        date: base.startDate,
        budgetItemId: incomeId,
        type: 'income',
        amount: 10.125,
        currency: 'DOP',
      },
      {
        _id: new Types.ObjectId(),
        date: base.startDate,
        budgetItemId: incomeId,
        type: 'income',
        amount: -2,
        currency: 'DOP',
      },
    ];
    const preview = await reports.preview(String(id), String(owner), {});
    expect(preview.blockers).toEqual([]);
    const result = await reports.confirm(String(id), String(owner), {
      confirmed: true,
      previewToken: preview.previewToken,
      actualCutoffDate: now.toISOString(),
    });
    expect(result.closedAt).toEqual(now);
    const [detail] = saved.mock.calls[0];
    expect(new Report(detail).toObject()).toMatchObject({
      totals: {
        totalPlanned: 35.13,
        totalActualIncome: 8.13,
        totalActualExpense: 2.13,
        totalVariance: 30.87,
      },
      includedTransactionIds: outside.map((row) => String(row._id)),
      items: [
        { actualAmount: 2.13, variance: 27.87 },
        { actualAmount: 8.13, variance: 3 },
      ],
    });
  });

  it.each(['2025-01-03', '2025-01-03T12:30:00'])(
    'TC1 rejects offsetless explicit cutoff %s at the DTO boundary',
    async (actualCutoffDate) => {
      const pipe = new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      });
      await expect(
        pipe.transform(
          { actualCutoffDate },
          { type: 'body', metatype: ClosePreviewDto },
        ),
      ).rejects.toThrow(BadRequestException);
      await expect(
        pipe.transform(
          { confirmed: true, previewToken: 'a'.repeat(64), actualCutoffDate },
          { type: 'body', metatype: ConfirmCloseDto },
        ),
      ).rejects.toThrow(BadRequestException);
    },
  );

  it('TC3 propagates a failed report save and never writes closed status', async () => {
    const preview = await reports.preview(String(id), String(owner), {});
    saved.mockImplementationOnce(() => {
      throw new Error('Injected report save failure');
    });
    await expect(
      reports.confirm(String(id), String(owner), {
        confirmed: true,
        previewToken: preview.previewToken,
        actualCutoffDate: now.toISOString(),
      }),
    ).rejects.toThrow('transactional database required');
    expect(written).not.toHaveBeenCalled();
  });

  it.each(['import', 'assignment'])(
    'TC4 rechecks source after a concurrent %s wins the controlled owner lock',
    async (operation) => {
      const transactionId = new Types.ObjectId();
      const row = {
        _id: transactionId,
        date: base.startDate,
        type: 'expense',
        currency: 'DOP',
        name: 'Synthetic purchase',
        amount: 20,
      };
      if (operation === 'assignment') outside = [row];
      const preview = await reports.preview(String(id), String(owner), {});
      // Controlled serial schedule. Real Mongo write conflicts are verified separately.
      let pending: Promise<unknown> = Promise.resolve();
      connection.session.withTransaction.mockImplementation(
        (work: () => Promise<unknown>) => {
          const operation = pending.then(work);
          pending = operation.catch(() => undefined);
          return operation;
        },
      );
      const history = {
        links: jest.fn().mockResolvedValue([]),
        isCovered: jest.fn().mockReturnValue(false),
        record: jest.fn().mockResolvedValue(undefined),
      };
      const normalization = new MerchantNormalizationService();
      const transaction = new TransactionsService(
        {
          db: connection,
          findOne: () => query(row),
          hydrate: (row: unknown) => row,
          findOneAndUpdate: () => {
            const assigned = {
              ...row,
              budgetItemId: itemId,
              matchingStatus: 'manual',
            };
            outside = [assigned];
            return query(assigned);
          },
        } as never,
        { findOne: () => query(current) } as never,
        {
          findOne: () => query({ _id: itemId, budgetId: id, type: 'expense' }),
        } as never,
        history as never,
      );
      const gmail = new TransactionMailPersistenceService(
        {
          db: connection,
          updateOne: () => {
            outside = [
              { ...row, budgetItemId: itemId, matchingStatus: 'matched' },
            ];
            return query({ upsertedCount: 1, upsertedId: transactionId });
          },
        } as never,
        normalization,
        {
          matchTransaction: () => ({
            budgetItemId: itemId,
            matchingStatus: 'matched',
          }),
        } as never,
        { load: () => Promise.resolve({}) } as never,
        history as never,
      );
      const write =
        operation === 'import'
          ? gmail.save(String(owner), [
              {
                accountId: String(new Types.ObjectId()),
                messageId: 'synthetic-mail',
                parserKey: 'synthetic',
                parserVersion: 1,
                transaction: {
                  description: row.name,
                  amount: row.amount,
                  currency: 'DOP',
                  type: 'expense',
                  transactionDate: row.date,
                  institutionId: String(new Types.ObjectId()),
                  accountType: 'credit_card',
                  accountLast4: '1234',
                },
              },
            ])
          : transaction.update(String(transactionId), String(owner), {
              budgetItemId: String(itemId),
            });
      const close = reports.confirm(String(id), String(owner), {
        confirmed: true,
        previewToken: preview.previewToken,
        actualCutoffDate: now.toISOString(),
      });
      await Promise.all([
        write,
        expect(close).rejects.toThrow('Coverage or source evidence changed'),
      ]);
      expect(saved).not.toHaveBeenCalled();
      expect(written).not.toHaveBeenCalled();
      const fresh = await reports.preview(String(id), String(owner), {});
      expect(fresh.includedTransactionIds).toEqual([String(transactionId)]);
      expect(fresh.blockers).toEqual([]);
      await reports.confirm(String(id), String(owner), {
        confirmed: true,
        previewToken: fresh.previewToken,
        actualCutoffDate: now.toISOString(),
      });
      expect(saved).toHaveBeenCalledTimes(1);
    },
  );

  it('TC3 rejects the old status path before attempting a write', async () => {
    await expect(
      service.update(String(id), String(owner), { status: 'closed' }),
    ).rejects.toThrow('POST /budgets/:id/close');
    expect(written).not.toHaveBeenCalled();
  });

  it('TC7 rejects closed budget and item changes before mutation', async () => {
    current.status = 'closed';
    const item = { name: 'Synthetic', type: 'expense', plannedAmount: 10 };
    const actions = [
      () => service.update(String(id), String(owner), { name: 'Changed' }),
      () => service.softDelete(String(id), String(owner)),
      () => service.addItem(String(id), String(owner), item),
      () =>
        service.updateBudgetItem(String(id), String(itemId), String(owner), {
          name: 'Changed',
        }),
      () =>
        service.softDeleteBudgetItem(String(id), String(itemId), String(owner)),
    ];
    for (const action of actions)
      await expect(action()).rejects.toThrow(/closed/i);
    expect(written).not.toHaveBeenCalled();
  });
  it.each([
    { actualCutoffDate: '2025-01-05T00:00:00Z' },
    { closeThroughDate: '2025-01-04' },
    { closeThroughDate: '2024-02-30' },
    {
      closeThroughDate: '2024-12-01',
      actualCutoffDate: '2024-12-02T04:00:00Z',
    },
    { actualCutoffDate: '2024-11-01T04:00:00Z' },
  ])('rejects invalid preview cutoff %j without writes', async (dto) => {
    await expect(
      reports.preview(String(id), String(owner), dto),
    ).rejects.toThrow(BadRequestException);
    expect(written).not.toHaveBeenCalled();
    expect(saved).not.toHaveBeenCalled();
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
    const preview = await reports.preview(String(id), String(owner), {
      actualCutoffDate: '2024-12-15T12:00:00Z',
    });
    expect(preview.blockers).toEqual([
      {
        code: 'assignment_outside_cutoff',
        transactionId: String(transactionId),
        budgetItemId: String(itemId),
      },
    ]);
    expect(preview.transactions).toEqual([]);
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
        currencyContext: {
          version: 1,
          currency: 'DOP',
          origin: 'dop-v1-planning',
        },
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
      service.update(String(id), String(owner), { status: 'active' }),
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
      currency: 'DOP',
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
    { currency: 'USD' },
    { currency: null },
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
