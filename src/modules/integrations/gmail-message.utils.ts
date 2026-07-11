import { gmail_v1 } from 'googleapis';

export function extractEmailAddress(fromHeader: string): string {
  const angleBracketMatch = fromHeader.match(/<([^<>]+)>/);
  return (angleBracketMatch?.[1] || fromHeader).trim().toLowerCase();
}

export function decodeGmailBody(data: string): string {
  return Buffer.from(data, 'base64url').toString('utf8');
}

export function extractMessageBody(
  payload?: gmail_v1.Schema$MessagePart,
): string {
  if (!payload) return '';

  const html = findMimePart(payload, 'text/html');
  if (html?.body?.data) return decodeGmailBody(html.body.data);

  const plainText = findMimePart(payload, 'text/plain');
  if (plainText?.body?.data) return decodeGmailBody(plainText.body.data);

  return payload.body?.data ? decodeGmailBody(payload.body.data) : '';
}

function findMimePart(
  part: gmail_v1.Schema$MessagePart,
  mimeType: string,
): gmail_v1.Schema$MessagePart | undefined {
  if (part.mimeType === mimeType && part.body?.data) return part;

  for (const child of part.parts || []) {
    const match = findMimePart(child, mimeType);
    if (match) return match;
  }

  return undefined;
}
