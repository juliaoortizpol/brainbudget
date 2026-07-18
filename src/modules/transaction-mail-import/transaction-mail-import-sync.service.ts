import { Injectable } from '@nestjs/common';
import { AccountsService } from '@/modules/accounts/accounts.service';
import { TransactionMailImportOptionsDto } from './dto/transaction-mail-import-options.dto';
import { TransactionMailImportPipelineService } from './transaction-mail-import-pipeline.service';
import { TransactionMailPersistenceService } from './transaction-mail-persistence.service';

@Injectable()
export class TransactionMailImportSyncService {
  constructor(
    private readonly pipeline: TransactionMailImportPipelineService,
    private readonly persistence: TransactionMailPersistenceService,
    private readonly accountsService: AccountsService,
  ) {}

  async sync(userId: string, options: TransactionMailImportOptionsDto) {
    const { context, fetched, parsing, matching } = await this.pipeline.run(
      userId,
      options,
    );
    const persistence = await this.persistence.save(
      userId,
      matching.transactions,
    );
    const failedMessageIds = new Set(
      persistence.issues.map((issue) => issue.messageId),
    );
    const failedAccountIds = new Set(
      matching.transactions
        .filter((envelope) => failedMessageIds.has(envelope.messageId))
        .map((envelope) => envelope.accountId),
    );
    const syncedAccountIds = [
      ...new Set(
        matching.transactions
          .map((envelope) => envelope.accountId)
          .filter((accountId) => !failedAccountIds.has(accountId)),
      ),
    ];
    const accountsMarkedSynced = await this.accountsService.markSynced(
      userId,
      syncedAccountIds,
    );
    const hasIssues =
      parsing.messagesFailed > 0 ||
      matching.transactionsUnmatched > 0 ||
      persistence.transactionsFailed > 0;

    return {
      success: persistence.transactionsFailed === 0,
      completedWithIssues: hasIssues,
      mode: 'sync',
      persisted: true,
      accounts: {
        reviewed:
          context.supportedAccounts.length + context.unsupportedAccounts.length,
        supported: context.supportedAccounts.length,
        unsupported: context.unsupportedAccounts.length,
        markedSynced: accountsMarkedSynced,
      },
      fetch: {
        messagesFound: fetched.messages.length,
        pagesRead: fetched.pagesRead,
        truncated: fetched.truncated,
        nextPageToken: fetched.nextPageToken,
      },
      parsing: {
        messagesReviewed: parsing.messagesReviewed,
        messagesParsed: parsing.messagesParsed,
        messagesIgnored: parsing.messagesIgnored,
        messagesFailed: parsing.messagesFailed,
        issues: parsing.issues,
      },
      matching: {
        transactionsReviewed: matching.transactionsReviewed,
        transactionsMatched: matching.transactionsMatched,
        transactionsUnmatched: matching.transactionsUnmatched,
        issues: matching.issues,
      },
      persistence,
    };
  }
}
