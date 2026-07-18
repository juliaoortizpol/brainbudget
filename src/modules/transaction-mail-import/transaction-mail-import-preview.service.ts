import { Injectable } from '@nestjs/common';
import { TransactionMailImportOptionsDto } from './dto/transaction-mail-import-options.dto';
import { TransactionMailImportPipelineService } from './transaction-mail-import-pipeline.service';

@Injectable()
export class TransactionMailImportPreviewService {
  constructor(
    private readonly pipeline: TransactionMailImportPipelineService,
  ) {}

  async preview(userId: string, options: TransactionMailImportOptionsDto) {
    const { context, mailQuery, fetched, parsing, matching } =
      await this.pipeline.run(userId, options);

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
      matching,
    };
  }
}
