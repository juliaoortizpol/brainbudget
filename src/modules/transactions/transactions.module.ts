import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TransactionsService } from './transactions.service';
import { TransactionsController } from './transactions.controller';
import { Transaction, TransactionSchema } from './schemas/transaction.schema';
import { MerchantNormalizationService } from './merchant-normalization.service';
import { Budget, BudgetSchema } from '../budgets/schemas/budget.schema';
import {
  BudgetItem,
  BudgetItemSchema,
} from '../budgets/schemas/budget-item.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Transaction.name, schema: TransactionSchema },
      { name: Budget.name, schema: BudgetSchema },
      { name: BudgetItem.name, schema: BudgetItemSchema },
    ]),
  ],
  controllers: [TransactionsController],
  providers: [TransactionsService, MerchantNormalizationService],
  exports: [TransactionsService, MerchantNormalizationService, MongooseModule],
})
export class TransactionsModule {}
