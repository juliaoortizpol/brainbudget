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

  it('creates a Gmail transaction using an atomic upsert', async () => {
    const exec = jest.fn().mockResolvedValue({ upsertedCount: 1 });
    const transactionModel = {
      updateOne: jest.fn().mockReturnValue({ exec }),
    };
    const service = new TransactionMailPersistenceService(
      transactionModel as any,
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
          accountId: expect.anything(),
          source: TransactionSource.GMAIL,
          sourceMessageId: envelope.messageId,
          parserKey: 'qik.credit-card',
          parserVersion: 1,
        }),
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
      transactionModel as any,
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
      transactionModel as any,
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
      transactionModel as any,
    );

    const result = await service.save(userId, [envelope]);

    expect(result.transactionsFailed).toBe(1);
    expect(result.issues).toEqual([
      { messageId: envelope.messageId, code: 'SAVE_FAILED' },
    ]);
  });
});
