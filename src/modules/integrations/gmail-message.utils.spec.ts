import { extractEmailAddress, extractMessageBody } from './gmail-message.utils';

describe('Gmail message utilities', () => {
  it('normalizes an address from a display-name From header', () => {
    expect(extractEmailAddress('Chase Alerts <Alerts@Chase.com>')).toBe(
      'alerts@chase.com',
    );
  });

  it('extracts nested HTML content', () => {
    const html = '<p>Transaction alert</p>';
    const payload = {
      mimeType: 'multipart/mixed',
      parts: [
        {
          mimeType: 'multipart/alternative',
          parts: [
            {
              mimeType: 'text/html',
              body: { data: Buffer.from(html).toString('base64url') },
            },
          ],
        },
      ],
    };

    expect(extractMessageBody(payload)).toBe(html);
  });

  it('falls back to plain text', () => {
    const text = 'Transaction alert';
    const payload = {
      mimeType: 'multipart/alternative',
      parts: [
        {
          mimeType: 'text/plain',
          body: { data: Buffer.from(text).toString('base64url') },
        },
      ],
    };

    expect(extractMessageBody(payload)).toBe(text);
  });
});
