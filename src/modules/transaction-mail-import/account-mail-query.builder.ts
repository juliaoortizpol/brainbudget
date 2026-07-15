import { Injectable } from '@nestjs/common';
import {
  BuiltMailQuery,
  MailImportContext,
  MailQueryOptions,
} from './contracts';

const DEFAULT_LOOKBACK_DAYS = 30;

@Injectable()
export class AccountMailQueryBuilder {
  buildMailQueryForUserAccounts(
    context: MailImportContext,
    options: MailQueryOptions = {},
  ): BuiltMailQuery {
    this.validateOptions(options);

    const queryableRules = context.rules
      .map((rule) => ({
        ...rule,
        senderAddresses: [
          ...new Set(
            rule.senderAddresses
              .map((sender) => sender.trim().toLowerCase())
              .filter(Boolean),
          ),
        ].sort(),
        subjectKeywords: [
          ...new Set(
            rule.subjectKeywords
              .map((subject) => subject.trim())
              .filter(Boolean),
          ),
        ].sort(),
      }))
      .filter(
        (rule) =>
          rule.senderAddresses.length > 0 && rule.subjectKeywords.length > 0,
      );

    const senderAddresses = [
      ...new Set(queryableRules.flatMap((rule) => rule.senderAddresses)),
    ].sort();
    const subjectKeywords = [
      ...new Set(queryableRules.flatMap((rule) => rule.subjectKeywords)),
    ].sort();

    const queryableAccountKeys = new Set(
      queryableRules.map((rule) => `${rule.institutionId}|${rule.accountType}`),
    );

    const supportedAccountIds = [
      ...new Set(
        context.supportedAccounts
          .filter(
            (account) =>
              account.institutionId &&
              queryableAccountKeys.has(
                `${account.institutionId}|${account.accountType}`,
              ),
          )
          .map((account) => account.accountId),
      ),
    ];

    if (queryableRules.length === 0) {
      return {
        query: null,
        senderAddresses,
        subjectKeywords,
        supportedAccountIds,
      };
    }

    const ruleQueries = [
      ...new Set(
        queryableRules.map((rule) => {
          const senderQuery = this.joinWithOr(
            rule.senderAddresses.map((sender) => `from:${sender}`),
          );
          const subjectQuery = this.joinWithOr(
            rule.subjectKeywords.map(
              (subject) => `subject:"${this.escapeQueryValue(subject)}"`,
            ),
          );
          return `(${senderQuery} ${subjectQuery})`;
        }),
      ),
    ];
    const dateQuery = options.after
      ? `after:${Math.floor(options.after.getTime() / 1000)}`
      : `newer_than:${options.newerThanDays ?? DEFAULT_LOOKBACK_DAYS}d`;

    return {
      query: `{${ruleQueries.join(' OR ')}} ${dateQuery}`,
      senderAddresses,
      subjectKeywords,
      supportedAccountIds,
    };
  }

  private joinWithOr(terms: string[]): string {
    return terms.length === 1 ? terms[0] : `{${terms.join(' OR ')}}`;
  }

  private escapeQueryValue(value: string): string {
    return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }

  private validateOptions(options: MailQueryOptions): void {
    if (options.after && options.newerThanDays !== undefined) {
      throw new Error('Use either after or newerThanDays, not both');
    }

    if (options.after && Number.isNaN(options.after.getTime())) {
      throw new Error('after must be a valid date');
    }

    if (
      options.newerThanDays !== undefined &&
      (!Number.isInteger(options.newerThanDays) || options.newerThanDays < 1)
    ) {
      throw new Error('newerThanDays must be a positive integer');
    }
  }
}
