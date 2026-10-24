import { BudgetMatchingContextService } from '@/modules/budgets/budget-matching-context.service';
import { Types } from 'mongoose';
import { BudgetMatchingService } from '@/modules/budgets/budget-matching.service';
import { MerchantNormalizationService } from '@/modules/transactions/merchant-normalization.service';
import { TransactionSource } from '@/modules/transactions/schemas/transaction.schema';
import { MatchedMailTransactionEnvelope } from './contracts';
import { TransactionMailPersistenceService } from './transaction-mail-persistence.service';

describe('TransactionMailPersistenceService', () => {
  const userId = '507f1f77bcf86cd799439011';
  const envelope: MatchedMailTransactionEnvelope = {
    messageId: 'gmail-message-1',
    parserKey: 'qik.credit-card',
    parserVersion: 1,
    accountId: '507f191e810c19729de860ea',
    transaction: {
      institutionId: '507f191e810c19729de860eb',
      accountType: 'credit_card',
      accountLast4: '6747',
      amount: 611.63,
      currency: 'DOP',
      type: 'expense',
      description: 'APPLE.COM/BILL',
      transactionDate: new Date('2026-07-13T04:09:00.000Z'),
    },
  };

  it('loads budgets and items once for 100 transactions', async () => {
    const budget = {
      _id: new Types.ObjectId(),
      userId: new Types.ObjectId(userId),
      status: 'active',
      isDeleted: false,
      startDate: new Date('2026-07-01'),
      endDate: new Date('2026-07-31'),
    };
    const budgets = {
      find: jest
        .fn()
        .mockReturnValue({ exec: jest.fn().mockResolvedValue([budget]) }),
    };
    const items = {
      find: jest
        .fn()
        .mockReturnValue({ exec: jest.fn().mockResolvedValue([]) }),
    };
    const transactionModel = {
      updateOne: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({ upsertedCount: 1 }),
      }),
    };
    const normalization = new MerchantNormalizationService();
    const service = new TransactionMailPersistenceService(
      transactionModel as unknown as ConstructorParameters<
        typeof TransactionMailPersistenceService
      >[0],
      normalization,
      new BudgetMatchingService(normalization),
      new BudgetMatchingContextService(
        budgets as unknown as ConstructorParameters<
          typeof BudgetMatchingContextService
        >[0],
        items as unknown as ConstructorParameters<
          typeof BudgetMatchingContextService
        >[1],
      ),
    );
    const result = await service.save(
      userId,
      Array.from({ length: 100 }, (_, index) => ({
        ...envelope,
        messageId: `mail-${index}`,
      })),
    );
    expect(result.transactionsCreated).toBe(100);
    expect(budgets.find).toHaveBeenCalledTimes(1);
    expect(items.find).toHaveBeenCalledTimes(1);
    expect(budgets.find).toHaveBeenCalledWith({
      userId: budget.userId,
      status: 'active',
      isDeleted: false,
    });
    expect(items.find).toHaveBeenCalledWith({
      userId: budget.userId,
      budgetId: { $in: [budget._id] },
      isDeleted: false,
    });
    await service.save(userId, []);
    expect(budgets.find).toHaveBeenCalledTimes(1);
  });

  it('creates a Gmail transaction using an atomic upsert', async () => {
    const exec = jest.fn().mockResolvedValue({ upsertedCount: 1 });
    const transactionModel = {
      updateOne: jest.fn().mockReturnValue({ exec }),
    };
    const service = new TransactionMailPersistenceService(
      transactionModel as unknown as ConstructorParameters<
        typeof TransactionMailPersistenceService
      >[0],
      new MerchantNormalizationService(),
      {
        matchTransaction: jest
          .fn()
          .mockImplementation((transaction: Record<string, unknown>) => ({
            ...transaction,
            matchingStatus: 'matched',
            matchingSource: 'rule',
            budgetItemId: '507f191e810c19729de860ec',
          })),
      } as unknown as BudgetMatchingService,
      {
        load: jest.fn().mockResolvedValue({ budgets: [], items: [] }),
      } as unknown as BudgetMatchingContextService,
    );

    const result = await service.save(userId, [envelope]);

    expect(result).toEqual({
      transactionsAttempted: 1,
      transactionsCreated: 1,
      duplicatesSkipped: 0,
      transactionsFailed: 0,
      issues: [],
    });
    expect(transactionModel.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({
        source: TransactionSource.GMAIL,
        sourceMessageId: envelope.messageId,
      }),
      {
        $setOnInsert: expect.objectContaining({
          accountId: expect.anything() as unknown,
          source: TransactionSource.GMAIL,
          sourceMessageId: envelope.messageId,
          parserKey: 'qik.credit-card',
          parserVersion: 1,
          rawDescription: 'APPLE.COM/BILL',
          normalizedMerchant: 'apple bill',
          matchingStatus: 'matched',
          matchingSource: 'rule',
          budgetItemId: '507f191e810c19729de860ec',
        }) as unknown,
      },
      { upsert: true, runValidators: true },
    );
  });

  it('counts an existing upsert target as a duplicate', async () => {
    const transactionModel = {
      updateOne: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({ upsertedCount: 0 }),
      }),
    };
    const service = new TransactionMailPersistenceService(
      transactionModel as unknown as ConstructorParameters<
        typeof TransactionMailPersistenceService
      >[0],
      new MerchantNormalizationService(),
      {
        matchTransaction: jest
          .fn()
          .mockImplementation((transaction: Record<string, unknown>) => ({
            ...transaction,
            matchingStatus: 'needs_review',
          })),
      } as unknown as BudgetMatchingService,
      {
        load: jest.fn().mockResolvedValue({ budgets: [], items: [] }),
      } as unknown as BudgetMatchingContextService,
    );

    const result = await service.save(userId, [envelope]);

    expect(result.transactionsCreated).toBe(0);
    expect(result.duplicatesSkipped).toBe(1);
  });

  it('treats a duplicate-key race as a skipped duplicate', async () => {
    const transactionModel = {
      updateOne: jest.fn().mockReturnValue({
        exec: jest.fn().mockRejectedValue({ code: 11000 }),
      }),
    };
    const service = new TransactionMailPersistenceService(
      transactionModel as unknown as ConstructorParameters<
        typeof TransactionMailPersistenceService
      >[0],
      new MerchantNormalizationService(),
      {
        matchTransaction: jest
          .fn()
          .mockImplementation((transaction: Record<string, unknown>) => ({
            ...transaction,
            matchingStatus: 'needs_review',
          })),
      } as unknown as BudgetMatchingService,
      {
        load: jest.fn().mockResolvedValue({ budgets: [], items: [] }),
      } as unknown as BudgetMatchingContextService,
    );

    const result = await service.save(userId, [envelope]);

    expect(result.duplicatesSkipped).toBe(1);
    expect(result.transactionsFailed).toBe(0);
  });

  it('reports a non-duplicate persistence failure', async () => {
    const transactionModel = {
      updateOne: jest.fn().mockReturnValue({
        exec: jest.fn().mockRejectedValue(new Error('database unavailable')),
      }),
    };
    const service = new TransactionMailPersistenceService(
      transactionModel as unknown as ConstructorParameters<
        typeof TransactionMailPersistenceService
      >[0],
      new MerchantNormalizationService(),
      {
        matchTransaction: jest
          .fn()
          .mockImplementation((transaction: Record<string, unknown>) => ({
            ...transaction,
            matchingStatus: 'needs_review',
          })),
      } as unknown as BudgetMatchingService,
      {
        load: jest.fn().mockResolvedValue({ budgets: [], items: [] }),
      } as unknown as BudgetMatchingContextService,
    );

    const result = await service.save(userId, [envelope]);

    expect(result.transactionsFailed).toBe(1);
    expect(result.issues).toEqual([
      { messageId: envelope.messageId, code: 'SAVE_FAILED' },
    ]);
  });
});
