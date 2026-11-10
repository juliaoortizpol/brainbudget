import { Types } from 'mongoose';
import { BudgetsService } from './budgets.service';

describe('BudgetsService spent calculation', () => {
  afterEach(() => jest.useRealTimers());
  it.each([undefined, new Date('2026-08-10T12:00:00Z')])(
    'keeps the as-of-now ceiling after planned end and normalizes references (cutoff %s)',
    async (actualCutoffDate) => {
      const now = new Date('2026-08-15T12:34:56.789Z');
      jest.useFakeTimers().setSystemTime(now);
      const itemId = new Types.ObjectId('6a5b91334af841141d1cdaf8');
      const aggregate = jest
        .fn<Promise<unknown[]>, [unknown[]]>()
        .mockResolvedValue([
          {
            _id: itemId,
            totalSpent: 8310.119999999999,
          },
        ]);
      const budget = {
        userId: new Types.ObjectId('69e7e32d72be00b046f1b706'),
        startDate: new Date('2026-07-01T00:00:00.000Z'),
        endDate: new Date('2026-07-31T23:59:59.999Z'),
        coverageVersion: 1,
        timezone: 'UTC',
        actualCutoffDate,
      };
      const item = {
        _id: itemId,
        toObject: () => ({ _id: itemId, name: 'Food' }),
      };

      const findBudget = jest.fn().mockReturnValue({
        exec: jest
          .fn()
          .mockResolvedValue({ ...budget, toObject: () => budget }),
      });
      const findItems = jest
        .fn()
        .mockReturnValue({ exec: jest.fn().mockResolvedValue([item]) });
      const publicService = new BudgetsService(
        { findOne: findBudget } as unknown as ConstructorParameters<
          typeof BudgetsService
        >[0],
        { find: findItems } as unknown as ConstructorParameters<
          typeof BudgetsService
        >[1],
        { aggregate } as unknown as ConstructorParameters<
          typeof BudgetsService
        >[2],
      );
      const { items: result } = await publicService.findOne(
        '507f1f77bcf86cd799439011',
        budget.userId.toString(),
      );

      expect(result).toEqual([
        expect.objectContaining({
          _id: itemId,
          spent: 8310.12,
        }),
      ]);
      expect(aggregate).toHaveBeenCalledWith(
        expect.arrayContaining([
          {
            $addFields: {
              normalizedBudgetItemId: {
                $convert: {
                  input: '$budgetItemId',
                  to: 'objectId',
                  onError: null,
                  onNull: null,
                },
              },
            },
          },
          {
            $group: {
              _id: '$normalizedBudgetItemId',
              totalSpent: { $sum: { $abs: '$amount' } },
            },
          },
        ]),
      );
      expect(
        (aggregate.mock.calls[0][0] as { $match: { date: unknown } }[])[0]
          .$match.date,
      ).toEqual({
        $gte: budget.startDate,
        $lte: now,
        ...(actualCutoffDate ? { $lt: actualCutoffDate } : {}),
      });
    },
  );
});
