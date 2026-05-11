import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from '../../users/schemas/user.schema';
import { Account } from '../../accounts/schemas/account.schema';
import { BudgetItem } from '../../budgets/schemas/budget-item.schema';

export type TransactionDocument = Transaction & Document;

@Schema({ timestamps: true })
export class Transaction {
  @Prop({ type: Types.ObjectId, ref: User.name, required: true })
  userId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: Account.name, required: true })
  accountId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: BudgetItem.name })
  budgetItemId?: Types.ObjectId;

  @Prop({ required: true })
  name!: string;

  @Prop({ required: true })
  amount!: number;

  @Prop({ required: true, enum: ['expense', 'income'] })
  type!: string;

  @Prop()
  relationCode?: string;

  @Prop({ required: true })
  date!: Date;

  @Prop()
  notes?: string;
}

export const TransactionSchema = SchemaFactory.createForClass(Transaction);
