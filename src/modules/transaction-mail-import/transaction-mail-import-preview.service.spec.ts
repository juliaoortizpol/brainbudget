import { TransactionMailImportPreviewService } from './transaction-mail-import-preview.service';

describe('TransactionMailImportPreviewService', () => {
  it('returns pipeline details without persisting', async () => {
    const run = {
      context: {
        supportedAccounts: [{ accountId: 'account-1' }],
        unsupportedAccounts: [],
      },
      mailQuery: { query: 'from:notificaciones@qik.do' },
      fetched: {
        messages: [{ id: 'message-1' }],
        pagesRead: 1,
        truncated: false,
      },
      parsing: { transactions: [{ messageId: 'message-1' }] },
      matching: {
        transactions: [{ messageId: 'message-1', accountId: 'account-1' }],
      },
    };
    const pipeline = { run: jest.fn().mockResolvedValue(run) };
    const service = new TransactionMailImportPreviewService(pipeline as any);
    const options = { newerThanDays: 30, maxPages: 5, pageSize: 50 };

    const result = await service.preview('user-1', options);

    expect(pipeline.run).toHaveBeenCalledWith('user-1', options);
    expect(result).toMatchObject({
      mode: 'preview',
      persisted: false,
      accounts: { reviewed: 1 },
      fetch: { messagesFound: 1, pagesRead: 1 },
      parsing: run.parsing,
      matching: run.matching,
    });
  });
});
