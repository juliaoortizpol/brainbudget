import { extractBody, mapGmailMessage } from './gmail-message.mapper';

describe('Gmail message mapper', () => {
  it('extracts nested HTML and normalizes headers', () => {
    const html = '<p>Bank notification</p>';
    const message = mapGmailMessage({
      id: 'message-1',
      threadId: 'thread-1',
      internalDate: '1783850400000',
      snippet: 'Bank notification',
      payload: {
        mimeType: 'multipart/alternative',
        headers: [
          { name: 'From', value: 'Bank <alerts@bank.test>' },
          { name: 'To', value: 'one@test.dev, two@test.dev' },
          { name: 'Subject', value: 'Transaction alert' },
          { name: 'Date', value: 'Sun, 12 Jul 2026 10:00:00 -0400' },
        ],
        parts: [
          {
            mimeType: 'text/html',
            body: { data: Buffer.from(html).toString('base64url') },
          },
        ],
      },
    });

    expect(message).toMatchObject({
      id: 'message-1',
      from: 'Bank <alerts@bank.test>',
      to: ['one@test.dev', 'two@test.dev'],
      subject: 'Transaction alert',
      body: html,
    });
  });

  it('falls back to nested plain text', () => {
    const text = 'Plain message';
    expect(
      extractBody({
        mimeType: 'multipart/mixed',
        parts: [
          {
            mimeType: 'multipart/alternative',
            parts: [
              {
                mimeType: 'text/plain',
                body: { data: Buffer.from(text).toString('base64url') },
              },
            ],
          },
        ],
      }),
    ).toBe(text);
  });

  it('omits the body when requested', () => {
    const message = mapGmailMessage(
      {
        id: 'message-2',
        payload: {
          mimeType: 'text/plain',
          body: { data: Buffer.from('secret').toString('base64url') },
        },
      },
      false,
    );
    expect(message.body).toBe('');
  });
});
