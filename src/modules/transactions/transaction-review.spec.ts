import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Model, Types, model } from 'mongoose';
import { GetTransactionsFilterDto } from './dto/get-transactions-filter.dto';
import { TransactionsService } from './transactions.service';
import {
  TransactionDocument,
  TransactionSchema,
} from './schemas/transaction.schema';
import { BudgetDocument } from '../budgets/schemas/budget.schema';
import { BudgetItemDocument } from '../budgets/schemas/budget-item.schema';

describe('transaction review query', () => {
  const userId = new Types.ObjectId().toString();
  const accountId = new Types.ObjectId().toString();
  const budgetItemId = new Types.ObjectId().toString();
  const reviewPredicate = [
    { type: 'expense' },
    {
      $or: [
        { matchingStatus: 'needs_review' },
        { matchingStatus: null, budgetItemId: null },
      ],
    },
  ];

  function setup() {
    const chain = {
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([{ name: 'Synthetic expense' }]),
    };
    const find = jest.fn().mockReturnValue(chain);
    const countDocuments = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(5),
    });
    const service = new TransactionsService(
      { find, countDocuments } as unknown as Model<TransactionDocument>,
      {} as Model<BudgetDocument>,
      {} as Model<BudgetItemDocument>,
    );
    return { service, find, countDocuments, chain };
  }

  it('validates only the supported review value and keeps omission compatible', async () => {
    for (const matchingStatus of [undefined, 'needs_review']) {
      expect(
        await validate(
          plainToInstance(GetTransactionsFilterDto, { matchingStatus }),
        ),
      ).toEqual([]);
    }
    for (const matchingStatus of [
      'manual',
      'matched',
      '',
      'invalid',
      ['needs_review'],
    ]) {
      expect(
        await validate(
          plainToInstance(GetTransactionsFilterDto, { matchingStatus }),
        ),
      ).not.toHaveLength(0);
    }
  });

  it('applies review and ownership to both data and count before pagination', async () => {
    const { service, find, countDocuments, chain } = setup();
    const result = await service.findAll(userId, {
      matchingStatus: 'needs_review',
      page: 2,
      limit: 2,
    });
    const expected = {
      userId: new Types.ObjectId(userId),
      $and: reviewPredicate,
    };
    expect(find).toHaveBeenCalledWith(expected);
    expect(countDocuments).toHaveBeenCalledWith(expected);
    expect(chain.sort).toHaveBeenCalledWith({ date: -1 });
    expect(chain.skip).toHaveBeenCalledWith(2);
    expect(chain.limit).toHaveBeenCalledWith(2);
    expect(result).toEqual({
      data: [{ name: 'Synthetic expense' }],
      meta: { total: 5, page: 2, limit: 2, totalPages: 3 },
    });
  });

  it('intersects existing filters including an incompatible income type', async () => {
    const { service, find } = setup();
    await service.findAll(userId, {
      matchingStatus: 'needs_review',
      accountId,
      budgetItemId,
      type: 'income',
      startDate: '2026-11-01',
      endDate: '2026-11-30',
    });
    expect(find).toHaveBeenCalledWith({
      userId: new Types.ObjectId(userId),
      accountId: new Types.ObjectId(accountId),
      budgetItemId: new Types.ObjectId(budgetItemId),
      type: 'income',
      date: { $gte: new Date('2026-11-01'), $lte: new Date('2026-11-30') },
      $and: reviewPredicate,
    });
  });

  it('leaves the query unchanged without review', async () => {
    const { service, find, chain } = setup();
    await service.findAll(userId, { type: 'income' });
    expect(find).toHaveBeenCalledWith({
      userId: new Types.ObjectId(userId),
      type: 'income',
    });
    expect(chain.skip).toHaveBeenCalledWith(0);
    expect(chain.limit).toHaveBeenCalledWith(10);
  });

  it('demonstrates why legacy eligibility must use stored values before hydration', () => {
    const TransactionModel = model(
      'ReviewHydrationRegression',
      TransactionSchema,
    );
    const legacy = TransactionModel.hydrate({
      budgetItemId: new Types.ObjectId(),
    });
    expect(legacy.matchingStatus).toBe('needs_review');
    expect(
      TransactionModel.hydrate({ matchingStatus: null }).matchingStatus,
    ).toBeNull();
  });
});
