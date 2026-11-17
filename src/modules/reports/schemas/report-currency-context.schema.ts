import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import {
  BudgetCurrencyContext,
  BudgetCurrencyContextSchema,
  supportedBudgetCurrency,
} from '../../budgets/currency-policy';

@Schema({ _id: false })
export class ReportCurrencyEvidence {
  @Prop({ required: true })
  transactionId!: string;

  @Prop({ type: String, default: null })
  budgetItemId!: string | null;

  @Prop({ required: true, enum: ['DOP'] })
  currency!: string;

  @Prop({ required: true, enum: [1] })
  version!: number;

  @Prop({
    required: true,
    enum: [
      'manual-default',
      'explicit',
      'mail-parser',
      'explicit-resolution',
      'legacy-explicit',
    ],
  })
  origin!: string;
}

@Schema({ _id: false })
export class ReportCurrencyContext {
  @Prop({ type: BudgetCurrencyContextSchema, required: true })
  planning!: BudgetCurrencyContext;

  @Prop({ required: true, enum: [1] })
  version!: number;

  @Prop({ required: true, enum: ['DOP'] })
  actualsCurrency!: string;

  @Prop({ required: true, validate: (value: boolean) => value === true })
  complete!: boolean;

  /** Required explicitly, even when empty. No hydration-time completion default. */
  @Prop({
    type: [String],
    default: undefined,
    required: true,
    validate: (issues: string[]) => issues.length === 0,
  })
  unresolvedTransactionIds!: string[];

  @Prop({
    type: [SchemaFactory.createForClass(ReportCurrencyEvidence)],
    default: undefined,
    required: true,
  })
  transactions!: ReportCurrencyEvidence[];
}

export function reportCurrencyError(
  context?: ReportCurrencyContext,
): string | undefined {
  if (
    !context ||
    context.version !== 1 ||
    !supportedBudgetCurrency(context.planning)
  )
    return 'Explicit DOP V1 planning currency context is required';
  if (
    context.actualsCurrency !== 'DOP' ||
    context.complete !== true ||
    !Array.isArray(context.unresolvedTransactionIds) ||
    context.unresolvedTransactionIds.length ||
    !Array.isArray(context.transactions)
  )
    return 'Resolve all purchase currency issues before finalizing a report';
  const ids = new Set<string>();
  for (const evidence of context.transactions) {
    if (
      !evidence.transactionId ||
      ids.has(evidence.transactionId) ||
      evidence.currency !== 'DOP' ||
      evidence.version !== 1 ||
      ![
        'manual-default',
        'explicit',
        'mail-parser',
        'explicit-resolution',
        'legacy-explicit',
      ].includes(evidence.origin)
    )
      return 'Report requires unique explicit supported purchase currency evidence';
    ids.add(evidence.transactionId);
  }
  return undefined;
}

export const ReportCurrencyContextSchema = SchemaFactory.createForClass(
  ReportCurrencyContext,
);
