import { Injectable } from '@nestjs/common';
import { GmailMessage } from '@/modules/gmail-reader/gmail-reader.types';
import {
  InstitutionMailParser,
  MailImportRule,
  MailParsingIssueCode,
  MailParsingResult,
} from '../contracts';
import { InstitutionMailParserRegistry } from './institution-mail-parser.registry';

interface ParserCandidate {
  parser: InstitutionMailParser;
  rule: MailImportRule;
}

@Injectable()
export class InstitutionMailParsingService {
  constructor(private readonly registry: InstitutionMailParserRegistry) {}

  async parseMails(
    messages: GmailMessage[],
    rules: MailImportRule[],
  ): Promise<MailParsingResult> {
    const result: MailParsingResult = {
      transactions: [],
      messagesReviewed: messages.length,
      messagesParsed: 0,
      messagesIgnored: 0,
      messagesFailed: 0,
      issues: [],
    };

    for (const message of messages) {
      const matchingRules = rules.filter((rule) =>
        this.messageMatchesRule(message, rule),
      );
      if (matchingRules.length === 0) {
        result.messagesIgnored++;
        continue;
      }

      const candidates: ParserCandidate[] = [];
      let missingParserRule: MailImportRule | undefined;
      for (const rule of matchingRules) {
        const parser = this.registry.get(rule.parserKey, rule.parserVersion);
        if (!parser) {
          missingParserRule ??= rule;
          continue;
        }
        if (parser.canParse(message, rule)) {
          candidates.push({ parser, rule });
        }
      }

      if (candidates.length === 0) {
        result.messagesFailed++;
        result.issues.push(
          missingParserRule
            ? {
                messageId: message.id,
                code: MailParsingIssueCode.PARSER_NOT_REGISTERED,
                parserKey: missingParserRule.parserKey,
                parserVersion: missingParserRule.parserVersion,
              }
            : {
                messageId: message.id,
                code: MailParsingIssueCode.PARSER_REJECTED,
              },
        );
        continue;
      }

      if (candidates.length > 1) {
        result.messagesFailed++;
        result.issues.push({
          messageId: message.id,
          code: MailParsingIssueCode.AMBIGUOUS_RULE,
        });
        continue;
      }

      const { parser, rule } = candidates[0];
      try {
        const transactions = await parser.parse(message, rule);
        if (transactions.length === 0) {
          result.messagesFailed++;
          result.issues.push({
            messageId: message.id,
            code: MailParsingIssueCode.PARSER_REJECTED,
            parserKey: parser.parserKey,
            parserVersion: parser.version,
          });
          continue;
        }

        result.messagesParsed++;
        result.transactions.push(
          ...transactions.map((transaction) => ({
            messageId: message.id,
            threadId: message.threadId,
            parserKey: parser.parserKey,
            parserVersion: parser.version,
            transaction,
          })),
        );
      } catch {
        result.messagesFailed++;
        result.issues.push({
          messageId: message.id,
          code: MailParsingIssueCode.PARSER_FAILED,
          parserKey: parser.parserKey,
          parserVersion: parser.version,
        });
      }
    }

    return result;
  }

  private messageMatchesRule(
    message: GmailMessage,
    rule: MailImportRule,
  ): boolean {
    const sender = this.extractEmailAddress(message.from);
    const senderMatches = rule.senderAddresses.some(
      (candidate) => candidate.trim().toLowerCase() === sender,
    );
    const normalizedSubject = message.subject.toLowerCase();
    const subjectMatches = rule.subjectKeywords.some((keyword) =>
      normalizedSubject.includes(keyword.trim().toLowerCase()),
    );
    return senderMatches && subjectMatches;
  }

  private extractEmailAddress(fromHeader: string): string {
    const match = fromHeader.match(/<([^<>]+)>/);
    return (match?.[1] || fromHeader).trim().toLowerCase();
  }
}
