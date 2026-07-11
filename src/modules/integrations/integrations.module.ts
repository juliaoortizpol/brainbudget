import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './integrations.service';
import { SyncEngineService } from './sync-engine.service';
import {
  GmailConnection,
  GmailConnectionSchema,
} from './schemas/gmail-connection.schema';
import { EmailParserModule } from '@/modules/email-parser/email-parser.module';
import { TransactionsModule } from '@/modules/transactions/transactions.module';
import { AccountsModule } from '@/modules/accounts/accounts.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: GmailConnection.name, schema: GmailConnectionSchema },
    ]),
    EmailParserModule,
    TransactionsModule,
    AccountsModule,
  ],
  controllers: [IntegrationsController],
  providers: [IntegrationsService, SyncEngineService],
  exports: [IntegrationsService, SyncEngineService],
})
export class IntegrationsModule {}
