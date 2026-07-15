import { SupportedAccountType } from '@/modules/institutions/institution.constants';

export type ImportedTransactionType = 'expense' | 'income';

export interface ParsedMailTransaction {
  institutionId: string;
  accountType: SupportedAccountType;
  accountLast4?: string;
  amount: number;
  currency: string;
  type: ImportedTransactionType;
  description: string;
  transactionDate: Date;
  reference?: string;
}
