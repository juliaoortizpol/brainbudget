import { Module } from '@nestjs/common';
import { AccountMailQueryBuilder } from './account-mail-query.builder';
import { AccountMailContextService } from './account-mail-context.service';
import { AccountsModule } from '@/modules/accounts/accounts.module';
import { InstitutionsModule } from '@/modules/institutions/institutions.module';

@Module({
  imports: [AccountsModule, InstitutionsModule],
  providers: [AccountMailQueryBuilder, AccountMailContextService],
  exports: [AccountMailQueryBuilder, AccountMailContextService],
})
export class TransactionMailImportModule {}
