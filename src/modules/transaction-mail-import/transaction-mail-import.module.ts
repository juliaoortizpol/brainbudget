import { Module } from '@nestjs/common';
import { AccountMailQueryBuilder } from './account-mail-query.builder';
import { AccountMailContextService } from './account-mail-context.service';
import { AccountsModule } from '@/modules/accounts/accounts.module';
import { InstitutionsModule } from '@/modules/institutions/institutions.module';
import { GmailReaderModule } from '@/modules/gmail-reader/gmail-reader.module';
import { AccountMailFetcherService } from './account-mail-fetcher.service';
import { InstitutionMailParsersModule } from './parsers/institution-mail-parsers.module';

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
  ],
  exports: [
    AccountMailQueryBuilder,
    AccountMailContextService,
    AccountMailFetcherService,
  ],
})
export class TransactionMailImportModule {}
