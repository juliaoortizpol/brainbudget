import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from '../../users/schemas/user.schema';
import { Budget } from './budget.schema';
import { ExpenseCategory } from '../../categories/schemas/expense-category.schema';

export type BudgetItemDocument = BudgetItem & Document;

@Schema({ timestamps: true })
export class BudgetItem {
  @Prop({ type: Types.ObjectId, ref: Budget.name, required: true })
  budgetId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: User.name, required: true })
  userId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: ExpenseCategory.name, required: true })
  expenseCategoryId!: Types.ObjectId;

  @Prop({ required: true })
  plannedAmount!: number;

  @Prop()
  alertEnabled?: boolean;
}

export const BudgetItemSchema = SchemaFactory.createForClass(BudgetItem);
