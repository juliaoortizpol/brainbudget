import { Injectable } from '@nestjs/common';
import { GmailReaderService } from '@/modules/gmail-reader/gmail-reader.service';
import {
  AccountMailFetchOptions,
  AccountMailFetchResult,
  BuiltMailQuery,
} from './contracts';

const DEFAULT_PAGE_SIZE = 50;
const DEFAULT_MAX_PAGES = 10;

@Injectable()
export class AccountMailFetcherService {
  constructor(private readonly gmailReader: GmailReaderService) {}

  async getMailsBasedOnAccountsQuery(
    userId: string,
    mailQuery: BuiltMailQuery,
    options: AccountMailFetchOptions = {},
  ): Promise<AccountMailFetchResult> {
    this.validateOptions(options);

    if (!mailQuery.query) {
      return {
        messages: [],
        pagesRead: 0,
        truncated: false,
      };
    }

    const pageSize = options.pageSize ?? DEFAULT_PAGE_SIZE;
    const maxPages = options.maxPages ?? DEFAULT_MAX_PAGES;
    const includeBody = options.includeBody ?? true;
    const messagesById = new Map();
    let pageToken = options.pageToken;
    let pagesRead = 0;

    do {
      const page = await this.gmailReader.listMessages(userId, {
        query: mailQuery.query,
        maxResults: pageSize,
        includeBody,
        pageToken,
      });
      pagesRead++;

      for (const message of page.messages) {
        messagesById.set(message.id, message);
      }
      pageToken = page.nextPageToken;
    } while (pageToken && pagesRead < maxPages);

    return {
      messages: [...messagesById.values()],
      pagesRead,
      truncated: Boolean(pageToken),
      nextPageToken: pageToken,
    };
  }

  private validateOptions(options: AccountMailFetchOptions): void {
    if (
      options.pageSize !== undefined &&
      (!Number.isInteger(options.pageSize) ||
        options.pageSize < 1 ||
        options.pageSize > 100)
    ) {
      throw new Error('pageSize must be an integer between 1 and 100');
    }

    if (
      options.maxPages !== undefined &&
      (!Number.isInteger(options.maxPages) || options.maxPages < 1)
    ) {
      throw new Error('maxPages must be a positive integer');
    }
  }
}
