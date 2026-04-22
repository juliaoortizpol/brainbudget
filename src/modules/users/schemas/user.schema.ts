import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserDocument = User & Document;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true })
  email!: string;

  @Prop({ required: false })
  passwordHash?: string;

  @Prop({ required: false })
  googleId?: string;

  @Prop({ type: [String], default: ['local'] })
  providers!: string[];
}

export const UserSchema = SchemaFactory.createForClass(User);
