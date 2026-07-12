import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { User } from '@/modules/users/schemas/user.schema';

export type GmailReaderConnectionDocument =
  HydratedDocument<GmailReaderConnection>;

@Schema({ timestamps: true })
export class GmailReaderConnection {
  @Prop({ type: Types.ObjectId, ref: User.name, required: true, unique: true })
  userId!: Types.ObjectId;

  @Prop({ required: true })
  email!: string;

  @Prop({ required: true, select: false })
  refreshToken!: string;

  @Prop({ enum: ['active', 'disconnected', 'error'], default: 'active' })
  status!: string;

  @Prop()
  lastReadAt?: Date;
}

export const GmailReaderConnectionSchema = SchemaFactory.createForClass(
  GmailReaderConnection,
);
