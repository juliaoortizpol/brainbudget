import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from '../../users/schemas/user.schema';

export type AccountDocument = Account & Document;

@Schema({ timestamps: true })
export class Account {
  @Prop({ type: Types.ObjectId, ref: User.name, required: true })
  userId!: Types.ObjectId;

  @Prop({ required: true })
  name!: string;

  @Prop()
  email?: string;

  @Prop()
  bank?: string;

  @Prop({ enum: ['bank', 'cash', 'wallet', 'credit_card', 'other'] })
  type?: string;

  @Prop()
  currency?: string;
}

export const AccountSchema = SchemaFactory.createForClass(Account);
