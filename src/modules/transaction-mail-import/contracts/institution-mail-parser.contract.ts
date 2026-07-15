import { GmailMessage } from '@/modules/gmail-reader/gmail-reader.types';
import { MailImportRule } from './mail-import-context.contract';
import { ParsedMailTransaction } from './parsed-mail-transaction.contract';

export interface InstitutionMailParser {
  readonly parserKey: string;
  readonly version: number;

  canParse(message: GmailMessage, rule: MailImportRule): boolean;

  parse(
    message: GmailMessage,
    rule: MailImportRule,
  ): ParsedMailTransaction[] | Promise<ParsedMailTransaction[]>;
}
