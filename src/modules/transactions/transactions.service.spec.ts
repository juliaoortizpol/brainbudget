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

  beforeEach(() => {
    class TransactionModel {
      constructor(data: Record<string, unknown>) {
        saved = data;
      }
      save() {
        return Promise.resolve(saved);
      }
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
        exec: () => Promise.resolve({ budgetId: new Types.ObjectId() }),
      }),
    };
    budgets = {
      findOne: jest
        .fn<unknown, [Record<string, unknown>]>()
        .mockReturnValue({ exec: () => Promise.resolve({}) }),
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
      { _id: new Types.ObjectId(id), userId: new Types.ObjectId(userId) },
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
});
