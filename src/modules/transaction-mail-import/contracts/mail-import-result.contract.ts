export enum ImportedMailOutcome {
  PROCESSED = 'PROCESSED',
  DUPLICATE = 'DUPLICATE',
  IGNORED = 'IGNORED',
  UNMATCHED = 'UNMATCHED',
  FAILED = 'FAILED',
}

export interface MailImportAccountResult {
  accountId: string;
  institutionName: string;
  transactionsCreated: number;
  messagesProcessed: number;
  messagesFailed: number;
}

export interface TransactionMailImportResult {
  success: boolean;
  accountsReviewed: number;
  supportedAccounts: number;
  unsupportedAccounts: number;
  messagesFound: number;
  transactionsCreated: number;
  duplicatesSkipped: number;
  unmatchedMessages: number;
  failedMessages: number;
  accounts: MailImportAccountResult[];
}
