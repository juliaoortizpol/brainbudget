import { GmailMessage } from '@/modules/gmail-reader/gmail-reader.types';

export interface AccountMailFetchOptions {
  pageSize?: number;
  maxPages?: number;
  includeBody?: boolean;
  pageToken?: string;
}

export interface AccountMailFetchResult {
  messages: GmailMessage[];
  pagesRead: number;
  truncated: boolean;
  nextPageToken?: string;
}
