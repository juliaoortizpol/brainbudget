import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongoSchema, Types } from 'mongoose';
import { User } from '@/modules/users/schemas/user.schema';
import { Budget } from '@/modules/budgets/schemas/budget.schema';
import { BudgetItem } from '@/modules/budgets/schemas/budget-item.schema';
import type { Transaction } from '@/modules/transactions/schemas/transaction.schema';
import {
  ReportCurrencyContext,
  ReportCurrencyContextSchema,
  reportCurrencyError,
} from './report-currency-context.schema';

export type BudgetPeriodReportDocument = BudgetPeriodReport & Document;

export type SavedReportTransaction = Omit<
  Transaction,
  'userId' | 'accountId' | 'budgetItemId' | 'currency'
> & {
  transactionId: string;
  budgetItemId: string | null;
  accountId?: string;
  currency: string | null;
};

function isFinalSnapshot(this: BudgetPeriodReport): boolean {
  return this.snapshotVersion === 1;
}

@Schema({ _id: false })
class BudgetTotals {
  @Prop({ required: true })
  totalPlanned!: number;

  @Prop({ required: true })
  totalActualIncome!: number;

  @Prop({ required: true })
  totalActualExpense!: number;

  @Prop({ required: true })
  totalVariance!: number;
}

@Schema({ _id: false })
class ReportItem {
  @Prop()
  type?: string;

  @Prop()
  description?: string;

  @Prop()
  icon?: string;

  @Prop()
  color?: string;

  @Prop()
  alertEnabled?: boolean;

  @Prop({ type: [MongoSchema.Types.Mixed], default: undefined })
  matchingRules?: unknown[];

  @Prop()
  configuredPlannedAmount?: number;

  @Prop({ type: Types.ObjectId, ref: BudgetItem.name, required: true })
  budgetItemId!: Types.ObjectId;

  @Prop({ required: true })
  categoryName!: string;

  @Prop({ required: true })
  plannedAmount!: number;

  @Prop({ required: true })
  actualAmount!: number;

  @Prop({ required: true })
  variance!: number;
}

@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class BudgetPeriodReport {
  @Prop({ enum: [1] })
  snapshotVersion?: number;

  @Prop({ required: isFinalSnapshot })
  timezone?: string;

  @Prop({ type: Date })
  plannedEndDate?: Date | null;

  @Prop({ required: isFinalSnapshot })
  actualCutoffDate?: Date;

  @Prop({ type: [String], default: undefined, required: isFinalSnapshot })
  includedTransactionIds?: string[];

  @Prop({
    type: [MongoSchema.Types.Mixed],
    default: undefined,
    required: isFinalSnapshot,
  })
  transactions?: SavedReportTransaction[];

  @Prop({
    type: ReportCurrencyContextSchema,
    required: true,
    validate: {
      validator: (context: ReportCurrencyContext) =>
        !reportCurrencyError(context),
      message:
        'Resolve explicit DOP currency context and purchase evidence before report finalization',
    },
  })
  currencyContext!: ReportCurrencyContext;

  @Prop({ type: Types.ObjectId, ref: Budget.name, required: true })
  budgetId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: User.name, required: true })
  userId!: Types.ObjectId;

  @Prop({ required: true })
  budgetName!: string;

  @Prop({ required: true, enum: ['monthly', 'weekly', 'custom'] })
  periodType!: string;

  @Prop({ required: true })
  startDate!: Date;

  @Prop({ required: true })
  endDate!: Date;

  @Prop({ required: true })
  closedAt!: Date;

  @Prop({ type: BudgetTotals, required: true })
  totals!: BudgetTotals;

  @Prop({ type: [ReportItem], required: true })
  items!: ReportItem[];
}

export const BudgetPeriodReportSchema =
  SchemaFactory.createForClass(BudgetPeriodReport);
BudgetPeriodReportSchema.index(
  { userId: 1, budgetId: 1 },
  { unique: true, partialFilterExpression: { snapshotVersion: 1 } },
);
BudgetPeriodReportSchema.index({
  userId: 1,
  snapshotVersion: 1,
  includedTransactionIds: 1,
});
BudgetPeriodReportSchema.index({
  userId: 1,
  snapshotVersion: 1,
  actualCutoffDate: 1,
});
