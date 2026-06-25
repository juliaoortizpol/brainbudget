import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from '../../users/schemas/user.schema';

export type GmailConnectionDocument = GmailConnection & Document;

@Schema({ timestamps: true })
export class GmailConnection {
  @Prop({ type: Types.ObjectId, ref: User.name, required: true })
  userId!: Types.ObjectId;

  @Prop({ required: true })
  email!: string;

  @Prop()
  refreshToken?: string;

  @Prop()
  historyId?: string;

  @Prop()
  lastSyncedAt?: Date;

  @Prop({ enum: ['active', 'disconnected', 'error'], default: 'active' })
  status!: string;
}

export const GmailConnectionSchema = SchemaFactory.createForClass(GmailConnection);
