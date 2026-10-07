import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({ _id: false, id: false })
export class BudgetItemMatchingRule {
  @Prop({ required: true })
  id!: string;

  @Prop({ required: true, enum: ['merchant', 'description'] })
  field!: 'merchant' | 'description';

  @Prop({ required: true, enum: ['contains', 'equals'] })
  operator!: 'contains' | 'equals';

  @Prop({ required: true })
  value!: string;

  @Prop({ required: true, enum: ['user', 'suggested', 'learned'] })
  source!: 'user' | 'suggested' | 'learned';
}

export const BudgetItemMatchingRuleSchema = SchemaFactory.createForClass(
  BudgetItemMatchingRule,
);
