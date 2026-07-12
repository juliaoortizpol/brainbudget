import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from '@/modules/users/schemas/user.schema';
import { Institution } from '@/modules/institutions/schemas/institution.schema';

export type AccountDocument = Account & Document;

@Schema({ timestamps: true })
export class Account {
  @Prop({ type: Types.ObjectId, ref: User.name, required: true })
  userId!: Types.ObjectId;

  @Prop({ required: true })
  name!: string;

  @Prop({ required: true })
  institution!: string;

  @Prop({ type: Types.ObjectId, ref: Institution.name })
  institutionId?: Types.ObjectId;

  @Prop({
    enum: [
      'checking',
      'savings',
      'credit_card',
      'investment',
      'loan',
      'brokerage',
      'retirement',
      'other',
    ],
    default: 'checking',
  })
  type?: string;

  @Prop({ default: 0 })
  maxBalance?: number;

  @Prop({ maxlength: 4 })
  last4Digits?: string;

  @Prop({ enum: ['active', 'pending', 're_auth_required'], default: 'active' })
  status?: string;

  @Prop()
  lastSynced?: Date;

  @Prop()
  email?: string;

  @Prop({ default: false })
  isDeleted?: boolean;
}

export const AccountSchema = SchemaFactory.createForClass(Account);
