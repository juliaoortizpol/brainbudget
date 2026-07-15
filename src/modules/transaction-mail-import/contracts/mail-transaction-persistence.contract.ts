export enum MailTransactionPersistenceIssueCode {
  SAVE_FAILED = 'SAVE_FAILED',
}

export interface MailTransactionPersistenceIssue {
  messageId: string;
  code: MailTransactionPersistenceIssueCode;
}

export interface MailTransactionPersistenceResult {
  transactionsAttempted: number;
  transactionsCreated: number;
  duplicatesSkipped: number;
  transactionsFailed: number;
  issues: MailTransactionPersistenceIssue[];
}
