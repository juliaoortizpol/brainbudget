import { Injectable } from '@nestjs/common';
import { AccountMailContextService } from './account-mail-context.service';
import { AccountMailQueryBuilder } from './account-mail-query.builder';
import { AccountMailFetcherService } from './account-mail-fetcher.service';
import { InstitutionMailParsingService } from './parsers/institution-mail-parsing.service';
import { PreviewTransactionMailImportDto } from './dto/preview-transaction-mail-import.dto';

@Injectable()
export class TransactionMailImportPreviewService {
  constructor(
    private readonly contextService: AccountMailContextService,
    private readonly queryBuilder: AccountMailQueryBuilder,
    private readonly fetcher: AccountMailFetcherService,
    private readonly parsingService: InstitutionMailParsingService,
  ) {}

  async preview(userId: string, options: PreviewTransactionMailImportDto) {
    const context = await this.contextService.getContextForUser(userId);
    const mailQuery = this.queryBuilder.buildMailQueryForUserAccounts(context, {
      newerThanDays: options.newerThanDays,
    });
    const fetched = await this.fetcher.getMailsBasedOnAccountsQuery(
      userId,
      mailQuery,
      {
        maxPages: options.maxPages,
        pageSize: options.pageSize,
        includeBody: true,
      },
    );
    const parsing = await this.parsingService.parseMails(
      fetched.messages,
      context.rules,
    );

    return {
      mode: 'preview',
      persisted: false,
      accounts: {
        reviewed:
          context.supportedAccounts.length + context.unsupportedAccounts.length,
        supported: context.supportedAccounts,
        unsupported: context.unsupportedAccounts,
      },
      mailQuery,
      fetch: {
        messagesFound: fetched.messages.length,
        pagesRead: fetched.pagesRead,
        truncated: fetched.truncated,
        nextPageToken: fetched.nextPageToken,
      },
      parsing,
    };
  }
}
