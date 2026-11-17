import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

/** No defaults: hydration must never manufacture historical monetary evidence. */
@Schema({ _id: false })
export class BudgetCurrencyContext {
  @Prop({ required: true, enum: [1] })
  version!: number;

  @Prop({ required: true, enum: ['DOP'] })
  currency!: string;

  @Prop({ required: true, enum: ['dop-v1-planning', 'explicit-resolution'] })
  origin!: string;
}

export const BudgetCurrencyContextSchema = SchemaFactory.createForClass(
  BudgetCurrencyContext,
);

export function dopPlanningContext(): BudgetCurrencyContext {
  return { version: 1, currency: 'DOP', origin: 'dop-v1-planning' };
}

export function supportedBudgetCurrency(
  context?: BudgetCurrencyContext,
): boolean {
  return (
    context?.version === 1 &&
    context.currency === 'DOP' &&
    ['dop-v1-planning', 'explicit-resolution'].includes(context.origin)
  );
}

export function currencyIssue(
  currency: unknown,
): 'unknown_currency' | 'unsupported_currency' | undefined {
  if (currency === 'DOP') return undefined;
  return typeof currency === 'string' && /^[A-Z]{3}$/.test(currency)
    ? 'unsupported_currency'
    : 'unknown_currency';
}

export interface CurrencyIssue {
  transactionId: string;
  budgetItemId: string | null;
  currency: unknown;
  code: 'unknown_currency' | 'unsupported_currency';
}
