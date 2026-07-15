import { ParsedMailTransactionEnvelope } from './mail-parsing.contract';
import { SupportedAccountType } from '@/modules/institutions/institution.constants';

export enum AccountMatchingIssueCode {
  ACCOUNT_LAST4_MISSING = 'ACCOUNT_LAST4_MISSING',
  ACCOUNT_NOT_FOUND = 'ACCOUNT_NOT_FOUND',
  AMBIGUOUS_ACCOUNT = 'AMBIGUOUS_ACCOUNT',
}

export interface MatchedMailTransactionEnvelope extends ParsedMailTransactionEnvelope {
  accountId: string;
}

export interface AccountMatchingIssue {
  messageId: string;
  parserKey: string;
  parserVersion: number;
  code: AccountMatchingIssueCode;
  institutionId: string;
  accountType: SupportedAccountType;
  accountLast4?: string;
  candidateAccountIds: string[];
}

export interface AccountMatchingResult {
  transactionsReviewed: number;
  transactionsMatched: number;
  transactionsUnmatched: number;
  transactions: MatchedMailTransactionEnvelope[];
  issues: AccountMatchingIssue[];
}
