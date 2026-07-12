import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import {
  SUPPORTED_ACCOUNT_TYPES,
  SupportedAccountType,
} from '../institution.constants';

export type InstitutionDocument = HydratedDocument<Institution>;

@Schema({ _id: true })
export class InstitutionEmailRule {
  @Prop({ type: [String], required: true })
  senderAddresses!: string[];

  @Prop({ type: [String], default: [] })
  subjectKeywords!: string[];

  @Prop({ required: true })
  parserKey!: string;

  @Prop({ required: true, min: 1, default: 1 })
  parserVersion!: number;

  @Prop({ required: true, enum: SUPPORTED_ACCOUNT_TYPES })
  accountType!: SupportedAccountType;

  @Prop({ default: true })
  enabled!: boolean;
}

export const InstitutionEmailRuleSchema =
  SchemaFactory.createForClass(InstitutionEmailRule);

@Schema({ timestamps: true })
export class Institution {
  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  slug!: string;

  @Prop({ type: [String], default: [] })
  aliases!: string[];

  @Prop({ type: [String], enum: SUPPORTED_ACCOUNT_TYPES, default: [] })
  supportedAccountTypes!: SupportedAccountType[];

  @Prop({ type: [InstitutionEmailRuleSchema], default: [] })
  emailRules!: InstitutionEmailRule[];

  @Prop({ default: true })
  enabled!: boolean;
}

export const InstitutionSchema = SchemaFactory.createForClass(Institution);
InstitutionSchema.index({ enabled: 1 });
InstitutionSchema.index({ 'emailRules.senderAddresses': 1 });
