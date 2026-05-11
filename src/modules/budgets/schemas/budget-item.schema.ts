import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from '../../users/schemas/user.schema';
import { Budget } from './budget.schema';


export type BudgetItemDocument = BudgetItem & Document;

@Schema({ timestamps: true })
export class BudgetItem {
  @Prop({ type: Types.ObjectId, ref: Budget.name, required: true })
  budgetId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: User.name, required: true })
  userId!: Types.ObjectId;

  @Prop({ required: true })
  name!: string;

  @Prop()
  description?: string;

  @Prop({ required: true, enum: ['expense', 'income'] })
  type!: string;

  @Prop()
  icon?: string;

  @Prop()
  color?: string;

  @Prop({ required: true })
  plannedAmount!: number;

  @Prop()
  alertEnabled?: boolean;

  @Prop({ default: false })
  isDeleted?: boolean;

  @Prop()
  deletedAt?: Date;
}

export const BudgetItemSchema = SchemaFactory.createForClass(BudgetItem);
