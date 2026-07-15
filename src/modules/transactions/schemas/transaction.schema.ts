import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from '@/modules/users/schemas/user.schema';
import { Account } from '@/modules/accounts/schemas/account.schema';
import { BudgetItem } from '@/modules/budgets/schemas/budget-item.schema';

export type TransactionDocument = Transaction & Document;

export enum TransactionSource {
  MANUAL = 'manual',
  GMAIL = 'gmail',
}

@Schema({ timestamps: true })
export class Transaction {
  @Prop({ type: Types.ObjectId, ref: User.name, required: true })
  userId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: Account.name })
  accountId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: BudgetItem.name })
  budgetItemId?: Types.ObjectId;

  @Prop({ required: true })
  name!: string;

  @Prop({ required: true })
  amount!: number;

  @Prop({ required: true, enum: ['expense', 'income'] })
  type!: string;

  @Prop({ uppercase: true, trim: true })
  currency?: string;

  @Prop()
  relationCode?: string;

  @Prop({ required: true })
  date!: Date;

  @Prop()
  notes?: string;

  @Prop({
    required: true,
    enum: Object.values(TransactionSource),
    default: TransactionSource.MANUAL,
  })
  source!: TransactionSource;

  @Prop()
  sourceMessageId?: string;

  @Prop()
  parserKey?: string;

  @Prop()
  parserVersion?: number;
}

export const TransactionSchema = SchemaFactory.createForClass(Transaction);

TransactionSchema.index(
  { userId: 1, source: 1, sourceMessageId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      source: TransactionSource.GMAIL,
      sourceMessageId: { $type: 'string' },
    },
  },
);
