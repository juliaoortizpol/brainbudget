import { TransactionMailImportPreviewService } from './transaction-mail-import-preview.service';

describe('TransactionMailImportPreviewService', () => {
  it('runs context, query, fetch and parsing without persisting', async () => {
    const context = {
      userId: 'user-1',
      supportedAccounts: [{ accountId: 'account-1' }],
      unsupportedAccounts: [],
      rules: [{ parserKey: 'qik.credit-card' }],
    };
    const mailQuery = {
      query: 'from:notificaciones@qik.do newer_than:30d',
      senderAddresses: ['notificaciones@qik.do'],
      subjectKeywords: ['Usaste tu tarjeta de crédito Qik'],
      supportedAccountIds: ['account-1'],
    };
    const messages = [{ id: 'message-1' }];
    const parsing = {
      transactions: [{ messageId: 'message-1' }],
      messagesReviewed: 1,
      messagesParsed: 1,
      messagesIgnored: 0,
      messagesFailed: 0,
      issues: [],
    };
    const contextService = {
      getContextForUser: jest.fn().mockResolvedValue(context),
    };
    const queryBuilder = {
      buildMailQueryForUserAccounts: jest.fn().mockReturnValue(mailQuery),
    };
    const fetcher = {
      getMailsBasedOnAccountsQuery: jest.fn().mockResolvedValue({
        messages,
        pagesRead: 1,
        truncated: false,
      }),
    };
    const parsingService = {
      parseMails: jest.fn().mockResolvedValue(parsing),
    };
    const matching = {
      transactionsReviewed: 1,
      transactionsMatched: 1,
      transactionsUnmatched: 0,
      transactions: [{ messageId: 'message-1', accountId: 'account-1' }],
      issues: [],
    };
    const accountMatcher = {
      match: jest.fn().mockReturnValue(matching),
    };
    const service = new TransactionMailImportPreviewService(
      contextService as any,
      queryBuilder as any,
      fetcher as any,
      parsingService as any,
      accountMatcher as any,
    );

    const result = await service.preview('user-1', {
      newerThanDays: 30,
      maxPages: 5,
      pageSize: 50,
    });

    expect(result).toMatchObject({
      mode: 'preview',
      persisted: false,
      accounts: { reviewed: 1 },
      fetch: { messagesFound: 1, pagesRead: 1 },
      parsing,
      matching,
    });
    expect(parsingService.parseMails).toHaveBeenCalledWith(
      messages,
      context.rules,
    );
    expect(accountMatcher.match).toHaveBeenCalledWith(
      parsing.transactions,
      context.supportedAccounts,
    );
  });
});
