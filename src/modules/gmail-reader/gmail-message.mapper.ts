import { gmail_v1 } from 'googleapis';
import { GmailMessage } from './gmail-reader.types';

export function mapGmailMessage(
  message: gmail_v1.Schema$Message,
  includeBody = true,
): GmailMessage {
  const payload = message.payload;
  const headers = payload?.headers || [];
  const header = (name: string) =>
    headers.find((item) => item.name?.toLowerCase() === name.toLowerCase())
      ?.value || '';

  return {
    id: message.id || '',
    threadId: message.threadId || undefined,
    historyId: message.historyId || undefined,
    internalDate: parseTimestamp(message.internalDate),
    from: header('From'),
    to: splitAddresses(header('To')),
    subject: header('Subject'),
    sentAt: parseDate(header('Date')),
    snippet: message.snippet || '',
    body: includeBody ? extractBody(payload) : '',
    mimeType: payload?.mimeType || '',
  };
}

export function extractBody(payload?: gmail_v1.Schema$MessagePart): string {
  if (!payload) return '';
  const html = findPart(payload, 'text/html');
  if (html?.body?.data) return decodeBody(html.body.data);
  const text = findPart(payload, 'text/plain');
  if (text?.body?.data) return decodeBody(text.body.data);
  return payload.body?.data ? decodeBody(payload.body.data) : '';
}

function findPart(
  part: gmail_v1.Schema$MessagePart,
  mimeType: string,
): gmail_v1.Schema$MessagePart | undefined {
  if (part.mimeType === mimeType && part.body?.data) return part;
  for (const child of part.parts || []) {
    const match = findPart(child, mimeType);
    if (match) return match;
  }
  return undefined;
}

function decodeBody(data: string): string {
  return Buffer.from(data, 'base64url').toString('utf8');
}

function splitAddresses(value: string): string[] {
  return value
    .split(',')
    .map((address) => address.trim())
    .filter(Boolean);
}

function parseDate(value: string): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function parseTimestamp(value?: string | null): Date | undefined {
  if (!value) return undefined;
  const milliseconds = Number(value);
  if (!Number.isFinite(milliseconds)) return undefined;
  return new Date(milliseconds);
}
