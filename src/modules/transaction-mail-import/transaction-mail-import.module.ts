import { Module } from '@nestjs/common';
import { AccountMailQueryBuilder } from './account-mail-query.builder';
import { AccountMailContextService } from './account-mail-context.service';
import { AccountsModule } from '@/modules/accounts/accounts.module';
import { InstitutionsModule } from '@/modules/institutions/institutions.module';
import { GmailReaderModule } from '@/modules/gmail-reader/gmail-reader.module';
import { AccountMailFetcherService } from './account-mail-fetcher.service';
import { InstitutionMailParsersModule } from './parsers/institution-mail-parsers.module';
import { TransactionMailImportPreviewService } from './transaction-mail-import-preview.service';
import { TransactionMailImportAdminController } from './transaction-mail-import-admin.controller';
import { AdminGuard } from '@/common/guards/admin.guard';
import { TransactionMailAccountMatcher } from './transaction-mail-account.matcher';
import { TransactionsModule } from '@/modules/transactions/transactions.module';
import { TransactionMailPersistenceService } from './transaction-mail-persistence.service';

@Module({
  imports: [
    AccountsModule,
    InstitutionsModule,
    GmailReaderModule,
    InstitutionMailParsersModule,
    TransactionsModule,
  ],
  providers: [
    AccountMailQueryBuilder,
    AccountMailContextService,
    AccountMailFetcherService,
    TransactionMailAccountMatcher,
    TransactionMailPersistenceService,
    TransactionMailImportPreviewService,
    AdminGuard,
  ],
  exports: [
    AccountMailQueryBuilder,
    AccountMailContextService,
    AccountMailFetcherService,
    TransactionMailAccountMatcher,
    TransactionMailPersistenceService,
  ],
  controllers: [TransactionMailImportAdminController],
})
export class TransactionMailImportModule {}
