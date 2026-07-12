export const SUPPORTED_ACCOUNT_TYPES = [
  'checking',
  'savings',
  'credit_card',
  'investment',
  'loan',
  'brokerage',
  'retirement',
  'other',
] as const;

export type SupportedAccountType = (typeof SUPPORTED_ACCOUNT_TYPES)[number];
