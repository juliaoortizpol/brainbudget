import { ParsedMailTransaction } from './parsed-mail-transaction.contract';

export enum MailParsingIssueCode {
  PARSER_NOT_REGISTERED = 'PARSER_NOT_REGISTERED',
  PARSER_REJECTED = 'PARSER_REJECTED',
  AMBIGUOUS_RULE = 'AMBIGUOUS_RULE',
  PARSER_FAILED = 'PARSER_FAILED',
}

export interface ParsedMailTransactionEnvelope {
  messageId: string;
  threadId?: string;
  parserKey: string;
  parserVersion: number;
  transaction: ParsedMailTransaction;
}

export interface MailParsingIssue {
  messageId: string;
  code: MailParsingIssueCode;
  parserKey?: string;
  parserVersion?: number;
}

export interface MailParsingResult {
  transactions: ParsedMailTransactionEnvelope[];
  messagesReviewed: number;
  messagesParsed: number;
  messagesIgnored: number;
  messagesFailed: number;
  issues: MailParsingIssue[];
}
