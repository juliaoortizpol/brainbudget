import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { BudgetsModule } from './modules/budgets/budgets.module';
import { TransactionsModule } from './modules/transactions/transactions.module';
import { AccountsModule } from './modules/accounts/accounts.module';
import { GmailReaderModule } from './modules/gmail-reader/gmail-reader.module';
import { InstitutionsModule } from './modules/institutions/institutions.module';
import { TransactionMailImportModule } from './modules/transaction-mail-import/transaction-mail-import.module';
import { HealthController } from './modules/health/health.controller';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { validateEnvironment } from './config/validate-environment';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnvironment,
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const appEnvironment =
          configService.get<string>('APP_ENV') || 'development';
        const enableThrottling = ['beta', 'production'].includes(
          appEnvironment,
        );

        return [
          {
            ttl: 60_000,
            limit: 120,
            skipIf: () => !enableThrottling,
          },
        ];
      },
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>('MONGODB_URI'),
      }),
      inject: [ConfigService],
    }),
    AuthModule,
    UsersModule,
    BudgetsModule,
    TransactionsModule,
    AccountsModule,
    GmailReaderModule,
    InstitutionsModule,
    TransactionMailImportModule,
  ],
  controllers: [AppController, HealthController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
