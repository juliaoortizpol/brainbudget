import { TransactionMailImportPipelineService } from './transaction-mail-import-pipeline.service';

describe('TransactionMailImportPipelineService', () => {
  it('runs context, query, fetch, parsing and account matching in order', async () => {
    const context = {
      userId: 'user-1',
      supportedAccounts: [{ accountId: 'account-1' }],
      unsupportedAccounts: [],
      rules: [{ parserKey: 'qik.credit-card' }],
    };
    const mailQuery = {
      query: 'from:notificaciones@qik.do newer_than:30d',
    };
    const fetched = {
      messages: [{ id: 'message-1' }],
      pagesRead: 1,
      truncated: false,
    };
    const parsing = {
      transactions: [{ messageId: 'message-1' }],
    };
    const matching = {
      transactions: [{ messageId: 'message-1', accountId: 'account-1' }],
    };
    const contextService = {
      getContextForUser: jest.fn().mockResolvedValue(context),
    };
    const queryBuilder = {
      buildMailQueryForUserAccounts: jest.fn().mockReturnValue(mailQuery),
    };
    const fetcher = {
      getMailsBasedOnAccountsQuery: jest.fn().mockResolvedValue(fetched),
    };
    const parsingService = {
      parseMails: jest.fn().mockResolvedValue(parsing),
    };
    const accountMatcher = {
      match: jest.fn().mockReturnValue(matching),
    };
    const service = new TransactionMailImportPipelineService(
      contextService as unknown as ConstructorParameters<
        typeof TransactionMailImportPipelineService
      >[0],
      queryBuilder as unknown as ConstructorParameters<
        typeof TransactionMailImportPipelineService
      >[1],
      fetcher as unknown as ConstructorParameters<
        typeof TransactionMailImportPipelineService
      >[2],
      parsingService as unknown as ConstructorParameters<
        typeof TransactionMailImportPipelineService
      >[3],
      accountMatcher as unknown as ConstructorParameters<
        typeof TransactionMailImportPipelineService
      >[4],
    );
    const options = { newerThanDays: 30, maxPages: 5, pageSize: 50 };

    await expect(service.run('user-1', options)).resolves.toEqual({
      context,
      mailQuery,
      fetched,
      parsing,
      matching,
    });
    expect(queryBuilder.buildMailQueryForUserAccounts).toHaveBeenCalledWith(
      context,
      { newerThanDays: 30 },
    );
    expect(fetcher.getMailsBasedOnAccountsQuery).toHaveBeenCalledWith(
      'user-1',
      mailQuery,
      { maxPages: 5, pageSize: 50, includeBody: true },
    );
    expect(parsingService.parseMails).toHaveBeenCalledWith(
      fetched.messages,
      context.rules,
    );
    expect(accountMatcher.match).toHaveBeenCalledWith(
      parsing.transactions,
      context.supportedAccounts,
    );
  });
});
