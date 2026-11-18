import { Types } from 'mongoose';
import { BudgetReportsService } from './budget-reports.service';

describe('report history and saved detail (controlled reads)', () => {
  const userId = new Types.ObjectId();
  const foreign = new Types.ObjectId();
  const budgetId = new Types.ObjectId();
  const legacyId = new Types.ObjectId();
  const reportId = new Types.ObjectId();
  const transactionId = new Types.ObjectId().toString();
  const closed = { _id: budgetId, name: 'Closed' };
  const legacy = { _id: legacyId, name: 'Legacy' };
  const savedPurchase = {
    transactionId,
    amount: -10.125,
    name: 'Saved purchase',
  };
  const savedReport = {
    _id: reportId,
    budgetId,
    totals: { totalActualExpense: 10.13 },
    transactions: [savedPurchase],
  };

  function setup() {
    const query = (result: unknown) => ({
      sort: () => query(result),
      skip: () => query(result),
      limit: () => query(result),
      lean: () => query(result),
      exec: () => Promise.resolve(result),
    });
    const list = jest.fn(() => query([closed, legacy]));
    const reports = jest.fn(() => query([savedReport]));
    const detail = jest.fn(
      (filter: {
        _id: Types.ObjectId;
        userId: Types.ObjectId;
        snapshotVersion: number;
      }) =>
        query(
          filter._id.equals(reportId) &&
            filter.userId.equals(userId) &&
            filter.snapshotVersion === 1
            ? savedReport
            : null,
        ),
    );
    const service = new BudgetReportsService(
      { find: list, countDocuments: () => query(2) } as never,
      {} as never,
      {} as never,
      { find: reports, findOne: detail } as never,
    );
    return { service, list, reports, detail };
  }

  it('TC8/TC11 marks historical gaps explicitly and constrains the report lookup', async () => {
    const { service, list, reports } = setup();
    await expect(
      service.history(userId.toString(), 1, 20),
    ).resolves.toMatchObject({
      total: 2,
      data: [
        {
          ...closed,
          reportId,
          reportStatus: 'final',
          totals: savedReport.totals,
        },
        {
          ...legacy,
          reportId: null,
          reportStatus: 'unavailable',
          totals: null,
        },
      ],
    });
    expect(list).toHaveBeenCalledWith(
      { userId, status: 'closed', isDeleted: false },
      expect.anything(),
    );
    expect(reports).toHaveBeenCalledWith(
      { userId, budgetId: { $in: [budgetId, legacyId] }, snapshotVersion: 1 },
      { budgetId: 1, totals: 1 },
    );
  });

  it('TC6/TC8 reads saved drill-down and rejects a foreign or missing report/purchase', async () => {
    const { service, detail } = setup();
    await expect(
      service.transaction(String(userId), String(reportId), transactionId),
    ).resolves.toEqual(savedPurchase);
    await expect(
      service.transaction(String(foreign), String(reportId), transactionId),
    ).rejects.toThrow('Final report not found');
    await expect(
      service.transaction(String(userId), String(reportId), String(legacyId)),
    ).rejects.toThrow('Saved transaction not found');
    expect(detail).toHaveBeenCalledWith(
      { _id: reportId, userId, snapshotVersion: 1 },
      { userId: 0 },
    );
  });
});
