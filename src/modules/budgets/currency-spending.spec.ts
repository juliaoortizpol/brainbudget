import { Types } from 'mongoose';
import { BudgetsService } from './budgets.service';
import { dopPlanningContext } from './currency-policy';

describe('TC2/TC5 DOP spending contract (controlled aggregate results)', () => {
  it.each([true, false])(
    'returns DOP numeric fields and original issue links (resolved planning %s)',
    async (resolved) => {
      const owner = new Types.ObjectId();
      const id = new Types.ObjectId();
      const itemId = new Types.ObjectId();
      const usdId = new Types.ObjectId().toString();
      const unknownId = new Types.ObjectId().toString();
      const budget = {
        _id: id,
        userId: owner,
        coverageVersion: 1,
        timezone: 'UTC',
        status: 'active',
        startDate: new Date('2024-11-01'),
        currencyContext: resolved ? dopPlanningContext() : undefined,
      };
      const aggregate = jest
        .fn<Promise<unknown[]>, [Record<string, unknown>[]]>()
        .mockResolvedValue([
          {
            _id: itemId,
            totalSpent: 100.09999999999999,
            currencyIssues: [
              null,
              {
                transactionId: usdId,
                budgetItemId: itemId.toString(),
                currency: 'USD',
              },
            ],
          },
          {
            _id: null,
            totalSpent: 0,
            currencyIssues: [
              { transactionId: unknownId, budgetItemId: null, currency: null },
            ],
          },
        ]);
      const service = new BudgetsService(
        {
          findOne: () => ({
            exec: () => Promise.resolve({ ...budget, toObject: () => budget }),
          }),
        } as never,
        {
          find: () => ({
            exec: () =>
              Promise.resolve([
                {
                  _id: itemId,
                  toObject: () => ({ _id: itemId, plannedAmount: 120 }),
                },
              ]),
          }),
        } as never,
        { aggregate } as never,
      );
      const result = await service.findOne(id.toString(), owner.toString());
      expect(result).toMatchObject({
        actualsCurrency: 'DOP',
        actualsComplete: false,
        currencyContextResolved: resolved,
        items: [
          {
            spent: 100.1,
            plannedAmount: 120,
            spentCurrency: 'DOP',
            actualsComplete: false,
          },
        ],
      });
      expect(result.currencyIssues).toEqual([
        {
          transactionId: usdId,
          budgetItemId: itemId.toString(),
          currency: 'USD',
          code: 'unsupported_currency',
        },
        {
          transactionId: unknownId,
          budgetItemId: null,
          currency: null,
          code: 'unknown_currency',
        },
      ]);
      expect(result.items[0].currencyIssues).toEqual([
        result.currencyIssues[0],
      ]);
      const pipeline = aggregate.mock.calls[0][0];
      expect(pipeline[0]).toEqual({
        $match: {
          userId: owner,
          date: { $gte: budget.startDate, $lte: expect.any(Date) as unknown },
        },
      });
      expect(pipeline.at(-1)).toMatchObject({
        $group: {
          totalSpent: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$currency', 'DOP'] },
                    { $eq: ['$type', 'expense'] },
                  ],
                },
                { $abs: '$amount' },
                0,
              ],
            },
          },
        },
      });
    },
  );
});
