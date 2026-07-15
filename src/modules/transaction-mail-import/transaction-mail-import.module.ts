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

@Module({
  imports: [
    AccountsModule,
    InstitutionsModule,
    GmailReaderModule,
    InstitutionMailParsersModule,
  ],
  providers: [
    AccountMailQueryBuilder,
    AccountMailContextService,
    AccountMailFetcherService,
    TransactionMailAccountMatcher,
    TransactionMailImportPreviewService,
    AdminGuard,
  ],
  exports: [
    AccountMailQueryBuilder,
    AccountMailContextService,
    AccountMailFetcherService,
    TransactionMailAccountMatcher,
  ],
  controllers: [TransactionMailImportAdminController],
})
export class TransactionMailImportModule {}
