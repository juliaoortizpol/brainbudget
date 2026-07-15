import { GmailReaderService } from '@/modules/gmail-reader/gmail-reader.service';
import { AccountMailFetcherService } from './account-mail-fetcher.service';
import { BuiltMailQuery } from './contracts';

describe('AccountMailFetcherService', () => {
  const builtQuery: BuiltMailQuery = {
    query: '(from:alerts@bank.test subject:"Transaction") newer_than:30d',
    senderAddresses: ['alerts@bank.test'],
    subjectKeywords: ['Transaction'],
    supportedAccountIds: ['account-1'],
  };

  it('does not call Gmail when the account query is empty', async () => {
    const gmailReader = { listMessages: jest.fn() };
    const service = new AccountMailFetcherService(
      gmailReader as unknown as GmailReaderService,
    );

    const result = await service.getMailsBasedOnAccountsQuery('user-1', {
      ...builtQuery,
      query: null,
    });

    expect(result).toEqual({
      messages: [],
      pagesRead: 0,
      truncated: false,
    });
    expect(gmailReader.listMessages).not.toHaveBeenCalled();
  });

  it('reads all pages and removes duplicate message IDs', async () => {
    const gmailReader = {
      listMessages: jest
        .fn()
        .mockResolvedValueOnce({
          messages: [
            { id: 'message-1', subject: 'Transaction 1' },
            { id: 'message-2', subject: 'Transaction 2' },
          ],
          nextPageToken: 'page-2',
          resultSizeEstimate: 3,
        })
        .mockResolvedValueOnce({
          messages: [
            { id: 'message-2', subject: 'Transaction 2' },
            { id: 'message-3', subject: 'Transaction 3' },
          ],
          resultSizeEstimate: 3,
        }),
    };
    const service = new AccountMailFetcherService(
      gmailReader as unknown as GmailReaderService,
    );

    const result = await service.getMailsBasedOnAccountsQuery(
      'user-1',
      builtQuery,
      { pageSize: 25 },
    );

    expect(gmailReader.listMessages).toHaveBeenNthCalledWith(1, 'user-1', {
      query: builtQuery.query,
      maxResults: 25,
      includeBody: true,
      pageToken: undefined,
    });
    expect(gmailReader.listMessages).toHaveBeenNthCalledWith(2, 'user-1', {
      query: builtQuery.query,
      maxResults: 25,
      includeBody: true,
      pageToken: 'page-2',
    });
    expect(result.messages.map((message) => message.id)).toEqual([
      'message-1',
      'message-2',
      'message-3',
    ]);
    expect(result).toMatchObject({
      pagesRead: 2,
      truncated: false,
    });
  });

  it('returns a continuation token when the page limit is reached', async () => {
    const gmailReader = {
      listMessages: jest.fn().mockResolvedValue({
        messages: [{ id: 'message-1' }],
        nextPageToken: 'remaining-page',
        resultSizeEstimate: 10,
      }),
    };
    const service = new AccountMailFetcherService(
      gmailReader as unknown as GmailReaderService,
    );

    const result = await service.getMailsBasedOnAccountsQuery(
      'user-1',
      builtQuery,
      { maxPages: 1, includeBody: false },
    );

    expect(result).toMatchObject({
      pagesRead: 1,
      truncated: true,
      nextPageToken: 'remaining-page',
    });
  });

  it('propagates Gmail Reader errors without translating them', async () => {
    const error = new Error('GMAIL_REAUTH_REQUIRED');
    const gmailReader = {
      listMessages: jest.fn().mockRejectedValue(error),
    };
    const service = new AccountMailFetcherService(
      gmailReader as unknown as GmailReaderService,
    );

    await expect(
      service.getMailsBasedOnAccountsQuery('user-1', builtQuery),
    ).rejects.toBe(error);
  });
});
