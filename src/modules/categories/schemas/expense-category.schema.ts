import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from '../../users/schemas/user.schema';

export type ExpenseCategoryDocument = ExpenseCategory & Document;

@Schema({ timestamps: true })
export class ExpenseCategory {
  @Prop({ type: Types.ObjectId, ref: User.name, required: true })
  userId!: Types.ObjectId;

  @Prop({ required: true })
  name!: string;

  @Prop()
  relationCode?: string;

  @Prop()
  color?: string;

  @Prop()
  icon?: string;

  @Prop({ required: true, enum: ['expense', 'income'] })
  type!: string;

  @Prop({ default: false })
  isSystem?: boolean;
}

export const ExpenseCategorySchema = SchemaFactory.createForClass(ExpenseCategory);
