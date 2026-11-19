import { ClientSession, model, Types } from 'mongoose';
import { ClosedPeriodHistoryService } from './closed-period-history.service';
import { ClosedPeriodExceptionSchema } from './schemas/closed-period-exception.schema';
import {
  Transaction,
  TransactionSource,
} from '../transactions/schemas/transaction.schema';

describe('closed period exceptions (controlled persistence)', () => {
  const userId = new Types.ObjectId();
  const transactionId = new Types.ObjectId();
  const reportId = new Types.ObjectId();
  const budgetId = new Types.ObjectId();
  const itemId = new Types.ObjectId();
  const start = new Date('2025-01-01T04:00:00Z');
  const cutoff = new Date('2025-02-01T04:00:00Z');
  const report = {
    _id: reportId,
    budgetId,
    startDate: start,
    actualCutoffDate: cutoff,
  };
  const original: Transaction = {
    userId,
    budgetItemId: itemId,
    date: start,
    name: 'Synthetic purchase',
    amount: 12,
    type: 'expense',
    currency: 'DOP',
    matchingStatus: 'manual',
    matchingSource: 'manual',
    source: TransactionSource.MANUAL,
  };
  const session = {} as ClientSession;
  const Exception = model(
    'ControlledClosedPeriodException',
    ClosedPeriodExceptionSchema,
  );

  function setup() {
    const save = jest.fn(
      async (row: InstanceType<typeof Exception>, options: unknown) => {
        expect(options).toEqual({ session });
        await row.validate();
      },
    );
    const reportRead = jest.fn().mockReturnValue({
      lean: () => ({ exec: () => Promise.resolve([report]) }),
    });
    const previous = jest.fn().mockReturnValue({
      session: (value: unknown) => {
        expect(value).toBe(session);
        return { exec: () => Promise.resolve([reportId]) };
      },
    });
    const exists = jest
      .fn()
      .mockReturnValue({ exec: () => Promise.resolve(null) });
    class Events {
      static distinct = previous;
      constructor(private readonly data: unknown) {}
      save(options: unknown) {
        return save(new Exception(this.data), options);
      }
    }
    const service = new ClosedPeriodHistoryService(
      { find: reportRead, exists } as never,
      Events as never,
    );
    return { service, save, reportRead, previous, exists };
  }

  it('TC9 uses owned inclusive-start/exclusive-cutoff coverage and appends only included dates for new arrivals', async () => {
    const { service, save, reportRead } = setup();
    const links = await service.links(userId, [start], session);
    expect(reportRead).toHaveBeenCalledWith(
      {
        userId,
        snapshotVersion: 1,
        $or: [{ startDate: { $lte: start }, actualCutoffDate: { $gt: start } }],
      },
      { budgetId: 1, startDate: 1, actualCutoffDate: 1 },
      { session },
    );
    expect(service.isCovered(links, start)).toBe(true);
    expect(service.isCovered(links, cutoff)).toBe(false);
    await service.record(
      userId,
      transactionId,
      links,
      null,
      { ...original, date: cutoff },
      session,
    );
    expect(save).not.toHaveBeenCalled();
    await service.record(userId, transactionId, links, null, original, session);
    expect(save.mock.calls[0][0].toObject()).toMatchObject({
      userId,
      transactionId,
      budgetId,
      reportId,
      kind: 'late_arrival',
      includedInSnapshot: false,
      inCoverageAfter: true,
      before: null,
      after: { amount: 12, date: start },
    });
  });

  it('TC10 preserves before/after evidence for corrections and rejects deletion of linked evidence', async () => {
    const { service, previous, reportRead, save } = setup();
    const links = await service.links(
      userId,
      [start, cutoff],
      session,
      transactionId,
    );
    expect(previous).toHaveBeenCalledWith('reportId', {
      userId,
      transactionId,
    });
    expect(reportRead).toHaveBeenCalledWith(
      {
        userId,
        snapshotVersion: 1,
        $or: [
          { startDate: { $lte: start }, actualCutoffDate: { $gt: start } },
          { startDate: { $lte: cutoff }, actualCutoffDate: { $gt: cutoff } },
          { includedTransactionIds: String(transactionId) },
          { _id: { $in: [reportId] } },
        ],
      },
      {
        budgetId: 1,
        startDate: 1,
        actualCutoffDate: 1,
        includedTransactionIds: 1,
      },
      { session },
    );
    const included = [
      { ...links[0], includedTransactionIds: [String(transactionId)] },
    ];
    await service.record(
      userId,
      transactionId,
      included,
      original,
      { ...original },
      session,
    );
    expect(save).not.toHaveBeenCalled();
    await service.record(
      userId,
      transactionId,
      included,
      original,
      {
        ...original,
        amount: 20,
        type: 'income',
        date: cutoff,
        budgetItemId: undefined,
      },
      session,
    );
    expect(save.mock.calls[0][0].toObject()).toMatchObject({
      kind: 'correction',
      includedInSnapshot: true,
      inCoverageAfter: false,
      before: { amount: 12, type: 'expense', budgetItemId: String(itemId) },
      after: { amount: 20, type: 'income', budgetItemId: null },
    });
    await expect(
      service.protectDeletion(userId, transactionId, session),
    ).rejects.toMatchObject({
      response: { code: 'closed_period_transaction_retained' },
    });
  });

  it('TC8 requires an owned final report before looking up exceptions', async () => {
    const { service, exists } = setup();
    await expect(
      service.listForReport(String(userId), String(reportId), 1, 20),
    ).rejects.toThrow('Final report not found');
    expect(exists).toHaveBeenCalledWith({
      _id: reportId,
      userId,
      snapshotVersion: 1,
    });
  });
});
