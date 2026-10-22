import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

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

  @Prop({ enum: ['user', 'admin'], default: 'user' })
  role!: 'user' | 'admin';
}

export const UserSchema = SchemaFactory.createForClass(User);
