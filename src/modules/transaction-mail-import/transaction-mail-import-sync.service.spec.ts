import { TransactionMailImportSyncService } from './transaction-mail-import-sync.service';

describe('TransactionMailImportSyncService', () => {
  it('persists matched transactions and marks successful accounts as synced', async () => {
    const matchedTransaction = {
      messageId: 'message-1',
      accountId: '507f191e810c19729de860ea',
    };
    const pipelineResult = {
      context: {
        supportedAccounts: [{ accountId: matchedTransaction.accountId }],
        unsupportedAccounts: [{ account: { accountId: 'unsupported-1' } }],
      },
      fetched: {
        messages: [{ id: 'message-1' }],
        pagesRead: 1,
        truncated: false,
      },
      parsing: {
        messagesReviewed: 1,
        messagesParsed: 1,
        messagesIgnored: 0,
        messagesFailed: 0,
        issues: [],
      },
      matching: {
        transactionsReviewed: 1,
        transactionsMatched: 1,
        transactionsUnmatched: 0,
        transactions: [matchedTransaction],
        issues: [],
      },
    };
    const persistenceResult = {
      transactionsAttempted: 1,
      transactionsCreated: 1,
      duplicatesSkipped: 0,
      transactionsFailed: 0,
      issues: [],
    };
    const pipeline = { run: jest.fn().mockResolvedValue(pipelineResult) };
    const persistence = {
      save: jest.fn().mockResolvedValue(persistenceResult),
    };
    const accountsService = {
      markSynced: jest.fn().mockResolvedValue(1),
    };
    const service = new TransactionMailImportSyncService(
      pipeline as any,
      persistence as any,
      accountsService as any,
    );
    const options = { newerThanDays: 30, maxPages: 5, pageSize: 50 };

    const result = await service.sync('user-1', options);

    expect(persistence.save).toHaveBeenCalledWith('user-1', [
      matchedTransaction,
    ]);
    expect(accountsService.markSynced).toHaveBeenCalledWith('user-1', [
      matchedTransaction.accountId,
    ]);
    expect(result).toMatchObject({
      success: true,
      completedWithIssues: false,
      mode: 'sync',
      persisted: true,
      accounts: {
        reviewed: 2,
        supported: 1,
        unsupported: 1,
        markedSynced: 1,
      },
      persistence: persistenceResult,
    });
  });

  it('does not mark an account synced when one of its writes fails', async () => {
    const pipeline = {
      run: jest.fn().mockResolvedValue({
        context: { supportedAccounts: [{}], unsupportedAccounts: [] },
        fetched: { messages: [{}], pagesRead: 1, truncated: false },
        parsing: {
          messagesReviewed: 1,
          messagesParsed: 1,
          messagesIgnored: 0,
          messagesFailed: 0,
          issues: [],
        },
        matching: {
          transactionsReviewed: 1,
          transactionsMatched: 1,
          transactionsUnmatched: 0,
          transactions: [{ messageId: 'message-1', accountId: 'account-1' }],
          issues: [],
        },
      }),
    };
    const persistence = {
      save: jest.fn().mockResolvedValue({
        transactionsAttempted: 1,
        transactionsCreated: 0,
        duplicatesSkipped: 0,
        transactionsFailed: 1,
        issues: [{ messageId: 'message-1', code: 'SAVE_FAILED' }],
      }),
    };
    const accountsService = {
      markSynced: jest.fn().mockResolvedValue(0),
    };
    const service = new TransactionMailImportSyncService(
      pipeline as any,
      persistence as any,
      accountsService as any,
    );

    const result = await service.sync('user-1', {
      newerThanDays: 30,
      maxPages: 5,
      pageSize: 50,
    });

    expect(accountsService.markSynced).toHaveBeenCalledWith('user-1', []);
    expect(result).toMatchObject({
      success: false,
      completedWithIssues: true,
    });
  });
});
