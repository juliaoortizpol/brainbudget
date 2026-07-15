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

    const senderAddresses = [
      ...new Set(
        context.rules
          .flatMap((rule) => rule.senderAddresses)
          .map((sender) => sender.trim().toLowerCase())
          .filter(Boolean),
      ),
    ].sort();

    const supportedAccountIds = [
      ...new Set(context.supportedAccounts.map((account) => account.accountId)),
    ];

    if (senderAddresses.length === 0) {
      return {
        query: null,
        senderAddresses,
        supportedAccountIds,
      };
    }

    const senderQuery = `{${senderAddresses
      .map((sender) => `from:${sender}`)
      .join(' OR ')}}`;
    const dateQuery = options.after
      ? `after:${Math.floor(options.after.getTime() / 1000)}`
      : `newer_than:${options.newerThanDays ?? DEFAULT_LOOKBACK_DAYS}d`;

    return {
      query: `${senderQuery} ${dateQuery}`,
      senderAddresses,
      supportedAccountIds,
    };
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
