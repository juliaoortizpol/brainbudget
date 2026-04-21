import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from './user.schema';

export type UserProfileDocument = UserProfile & Document;

@Schema({ timestamps: true })
export class UserProfile {
  @Prop({ type: Types.ObjectId, ref: User.name, required: true })
  userId!: Types.ObjectId;

  @Prop({ required: true })
  fullName!: string;

  @Prop()
  career?: string;

  @Prop()
  age?: number;

  @Prop()
  gender?: string;

  @Prop()
  perceivedAvailableMoney?: number;
}

export const UserProfileSchema = SchemaFactory.createForClass(UserProfile);
