import { ConfigService } from '@nestjs/config';
import { GmailClientFactory } from './gmail-client.factory';
import { GmailReaderService } from './gmail-reader.service';

describe('GmailReaderService', () => {
  it('lists and normalizes a page of Gmail messages', async () => {
    const connection = {
      refreshToken: 'refresh-token',
      lastReadAt: undefined as Date | undefined,
      save: jest.fn().mockResolvedValue(undefined),
    };
    const connectionModel = {
      findOne: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(connection),
        }),
      }),
    };
    const gmail = {
      users: {
        messages: {
          list: jest.fn().mockResolvedValue({
            data: {
              messages: [{ id: 'message-1' }],
              nextPageToken: 'next-page',
              resultSizeEstimate: 4,
            },
          }),
          get: jest.fn().mockResolvedValue({
            data: {
              id: 'message-1',
              snippet: 'An alert',
              payload: {
                mimeType: 'text/plain',
                headers: [{ name: 'Subject', value: 'Transaction alert' }],
                body: {
                  data: Buffer.from('Message body').toString('base64url'),
                },
              },
            },
          }),
        },
      },
    };
    const clientFactory = {
      createGmailClient: jest.fn().mockReturnValue(gmail),
    };
    const service = new GmailReaderService(
      connectionModel as any,
      clientFactory as unknown as GmailClientFactory,
      { get: jest.fn() } as unknown as ConfigService,
    );

    const result = await service.listMessages('507f1f77bcf86cd799439011', {
      query: 'newer_than:7d',
      maxResults: 25,
      includeBody: true,
    });

    expect(gmail.users.messages.list).toHaveBeenCalledWith({
      userId: 'me',
      q: 'newer_than:7d',
      maxResults: 25,
      pageToken: undefined,
    });
    expect(result).toMatchObject({
      nextPageToken: 'next-page',
      resultSizeEstimate: 4,
      messages: [
        {
          id: 'message-1',
          subject: 'Transaction alert',
          body: 'Message body',
        },
      ],
    });
    expect(connection.lastReadAt).toBeInstanceOf(Date);
    expect(connection.save).toHaveBeenCalled();
  });
});
