import { Module } from '@nestjs/common';
import { AccountMailQueryBuilder } from './account-mail-query.builder';

@Module({
  providers: [AccountMailQueryBuilder],
  exports: [AccountMailQueryBuilder],
})
export class TransactionMailImportModule {}
