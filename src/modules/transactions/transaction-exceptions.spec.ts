import { model, Types } from 'mongoose';
import { ClosedPeriodHistoryService } from '../reports/closed-period-history.service';
import {
  ClosedPeriodException,
  ClosedPeriodExceptionSchema,
} from '../reports/schemas/closed-period-exception.schema';
import { TransactionSchema } from './schemas/transaction.schema';
import { TransactionsService } from './transactions.service';

describe('transaction closed-period exceptions (TC8, TC9, TC10)', () => {
  const Transaction = model('ExceptionReadTransaction', TransactionSchema);
  const Exception = model('ExceptionReadEvent', ClosedPeriodExceptionSchema);
  const owner = new Types.ObjectId();
  const other = new Types.ObjectId();
  const corrected = { _id: new Types.ObjectId(), userId: owner };
  const late = { _id: new Types.ObjectId(), userId: owner };
  const ordinary = { _id: new Types.ObjectId(), userId: owner };
  const foreign = { _id: new Types.ObjectId(), userId: other };
  const reportId = new Types.ObjectId();
  const service = new TransactionsService(
    Transaction as unknown as ConstructorParameters<
      typeof TransactionsService
    >[0],
    {} as never,
    {} as never,
    new ClosedPeriodHistoryService({} as never, Exception),
  );

  function event(
    transaction: typeof corrected,
    kind: ClosedPeriodException['kind'],
  ) {
    return {
      _id: new Types.ObjectId(),
      userId: transaction.userId,
      transactionId: transaction._id,
      reportId,
      kind,
    };
  }

  const first = event(corrected, 'correction');
  const second = event(corrected, 'correction');
  const arrival = event(late, 'late_arrival');
  const events = [
    first,
    second,
    arrival,
    event({ ...corrected, userId: other }, 'correction'),
  ];

  function matches(
    filter: Record<string, unknown>,
    row: Record<string, Types.ObjectId | string>,
  ) {
    // Mongo equality distinguishes ObjectId fields from their string forms.
    return Object.entries(filter).every(
      ([key, value]) =>
        value instanceof Types.ObjectId && value.equals(row[key]),
    );
  }

  let findTransaction: jest.SpyInstance;
  let findExceptions: jest.SpyInstance;
  let countExceptions: jest.SpyInstance;

  beforeEach(() => {
    // Execute production Mongoose queries against a controlled collection
    // boundary, so the filters below are what Mongoose passes to the driver.
    findTransaction = jest
      .spyOn(Transaction.collection, 'findOne')
      .mockImplementation((filter) =>
        Promise.resolve(
          [corrected, late, ordinary, foreign].find((row) =>
            matches(filter, row),
          ) ?? null,
        ),
      );
    findExceptions = jest
      .spyOn(Exception.collection, 'find')
      .mockImplementation(
        (filter, options) =>
          ({
            toArray: () => {
              expect(options).toMatchObject({
                sort: { _id: -1 },
                projection: { userId: 0 },
              });
              const { skip = 0, limit } = options ?? {};
              const page = events
                .filter((row) => matches(filter, row))
                .sort((a, b) =>
                  b._id.toHexString().localeCompare(a._id.toHexString()),
                )
                .slice(skip, limit === undefined ? undefined : skip + limit)
                .map(({ _id, transactionId, reportId, kind }) => ({
                  _id,
                  transactionId,
                  reportId,
                  kind,
                }));
              return Promise.resolve(page);
            },
          }) as unknown as ReturnType<typeof Exception.collection.find>,
      );
    countExceptions = jest
      .spyOn(Exception.collection, 'countDocuments')
      .mockImplementation((filter = {}) =>
        Promise.resolve(events.filter((row) => matches(filter, row)).length),
      );
  });

  afterEach(() => jest.restoreAllMocks());

  it('pages only the owned corrections in descending order with a stable total', async () => {
    const id = String(corrected._id);
    for (const [page, expected] of [
      [1, second],
      [2, first],
      [3, null],
    ] as const) {
      await expect(
        service.exceptions(id, String(owner), page, 1),
      ).resolves.toEqual({
        data: expected
          ? [
              {
                _id: expected._id,
                reportId,
                transactionId: corrected._id,
                kind: 'correction',
              },
            ]
          : [],
        page,
        limit: 1,
        total: 2,
      });
    }
  });

  it('returns the report-linked late arrival for its owner', async () => {
    await expect(
      service.exceptions(String(late._id), String(owner), 1, 20),
    ).resolves.toEqual({
      data: [
        {
          _id: arrival._id,
          reportId,
          transactionId: late._id,
          kind: 'late_arrival',
        },
      ],
      page: 1,
      limit: 20,
      total: 1,
    });
  });

  it('returns an empty page for an owned transaction without exceptions', async () => {
    await expect(
      service.exceptions(String(ordinary._id), String(owner), 1, 20),
    ).resolves.toEqual({ data: [], page: 1, limit: 20, total: 0 });
  });

  it.each([
    ['foreign', String(foreign._id)],
    ['missing', String(new Types.ObjectId())],
    ['invalid', 'invalid-id'],
  ])('returns 404 for transaction input classified as %s', async (kind, id) => {
    await expect(
      service.exceptions(id, String(owner), 1, 20),
    ).rejects.toMatchObject({
      status: 404,
      message: 'Transaction is unavailable',
    });
    expect(findExceptions).not.toHaveBeenCalled();
    expect(countExceptions).not.toHaveBeenCalled();
    if (kind === 'invalid') expect(findTransaction).not.toHaveBeenCalled();
  });
});
