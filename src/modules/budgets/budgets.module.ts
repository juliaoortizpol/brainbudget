import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BudgetsService } from './budgets.service';
import { BudgetsController } from './budgets.controller';
import { Budget, BudgetSchema } from './schemas/budget.schema';
import { BudgetItem, BudgetItemSchema } from './schemas/budget-item.schema';
import { BudgetMatchingService } from './budget-matching.service';
import { BudgetMatchingContextService } from './budget-matching-context.service';
import { TransactionsModule } from '@/modules/transactions/transactions.module';
import {
  Transaction,
  TransactionSchema,
} from '@/modules/transactions/schemas/transaction.schema';

@Module({
  imports: [
    TransactionsModule,
    MongooseModule.forFeature([
      { name: Budget.name, schema: BudgetSchema },
      { name: BudgetItem.name, schema: BudgetItemSchema },
      { name: Transaction.name, schema: TransactionSchema },
    ]),
  ],
  controllers: [BudgetsController],
  providers: [
    BudgetsService,
    BudgetMatchingService,
    BudgetMatchingContextService,
  ],
  exports: [
    BudgetsService,
    BudgetMatchingService,
    BudgetMatchingContextService,
  ],
})
export class BudgetsModule {}
