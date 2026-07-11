import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type InstitutionConfigDocument = InstitutionConfig & Document;

@Schema()
export class ParsingRule {
  @Prop({ required: true })
  accountType!: string;

  @Prop({ required: true })
  senderEmail!: string;

  @Prop({ type: [String], required: true })
  subjectKeywords!: string[];

  @Prop({ required: true })
  parserCodeId!: string;
}

const ParsingRuleSchema = SchemaFactory.createForClass(ParsingRule);

@Schema({ timestamps: true })
export class InstitutionConfig {
  @Prop({ required: true, unique: true })
  name!: string;

  @Prop({ type: [ParsingRuleSchema], default: [] })
  parsingRules!: ParsingRule[];
}

export const InstitutionConfigSchema = SchemaFactory.createForClass(InstitutionConfig);
