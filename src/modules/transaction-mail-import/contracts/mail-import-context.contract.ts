import { SupportedAccountType } from '@/modules/institutions/institution.constants';

export enum UnsupportedMailAccountReason {
  ACCOUNT_NOT_ACTIVE = 'ACCOUNT_NOT_ACTIVE',
  CUSTOM_INSTITUTION = 'CUSTOM_INSTITUTION',
  INSTITUTION_DISABLED = 'INSTITUTION_DISABLED',
  NO_ENABLED_EMAIL_RULES = 'NO_ENABLED_EMAIL_RULES',
  ACCOUNT_TYPE_NOT_SUPPORTED = 'ACCOUNT_TYPE_NOT_SUPPORTED',
}

export interface MailImportAccount {
  accountId: string;
  accountName: string;
  institutionName: string;
  institutionId?: string;
  accountType: SupportedAccountType;
  last4Digits?: string;
}

export interface MailImportRule {
  institutionId: string;
  institutionName: string;
  senderAddresses: string[];
  subjectKeywords: string[];
  parserKey: string;
  parserVersion: number;
  accountType: SupportedAccountType;
}

export interface UnsupportedMailAccount {
  account: MailImportAccount;
  reason: UnsupportedMailAccountReason;
}

export interface MailImportContext {
  userId: string;
  supportedAccounts: MailImportAccount[];
  unsupportedAccounts: UnsupportedMailAccount[];
  rules: MailImportRule[];
}
