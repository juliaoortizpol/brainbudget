import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from '../../users/schemas/user.schema';
import { Budget } from '../../budgets/schemas/budget.schema';
import { BudgetItem } from '../../budgets/schemas/budget-item.schema';

export type BudgetPeriodReportDocument = BudgetPeriodReport & Document;

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

export const BudgetPeriodReportSchema = SchemaFactory.createForClass(BudgetPeriodReport);
