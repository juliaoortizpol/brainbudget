import { Injectable } from '@nestjs/common';
import {
  AccountMatchingIssueCode,
  AccountMatchingResult,
  MailImportAccount,
  ParsedMailTransactionEnvelope,
} from './contracts';

@Injectable()
export class TransactionMailAccountMatcher {
  match(
    transactions: ParsedMailTransactionEnvelope[],
    accounts: MailImportAccount[],
  ): AccountMatchingResult {
    const result: AccountMatchingResult = {
      transactionsReviewed: transactions.length,
      transactionsMatched: 0,
      transactionsUnmatched: 0,
      transactions: [],
      issues: [],
    };

    for (const envelope of transactions) {
      const { transaction } = envelope;
      const baseCandidates = accounts.filter(
        (account) =>
          account.institutionId === transaction.institutionId &&
          account.accountType === transaction.accountType,
      );
      const accountLast4 = this.normalizeLast4(transaction.accountLast4);

      if (!accountLast4) {
        this.addIssue(
          result,
          envelope,
          AccountMatchingIssueCode.ACCOUNT_LAST4_MISSING,
          baseCandidates.map((account) => account.accountId),
        );
        continue;
      }

      const matchingAccounts = baseCandidates.filter(
        (account) => this.normalizeLast4(account.last4Digits) === accountLast4,
      );

      if (matchingAccounts.length === 0) {
        this.addIssue(
          result,
          envelope,
          AccountMatchingIssueCode.ACCOUNT_NOT_FOUND,
          [],
        );
        continue;
      }

      if (matchingAccounts.length > 1) {
        this.addIssue(
          result,
          envelope,
          AccountMatchingIssueCode.AMBIGUOUS_ACCOUNT,
          matchingAccounts.map((account) => account.accountId),
        );
        continue;
      }

      result.transactions.push({
        ...envelope,
        accountId: matchingAccounts[0].accountId,
      });
      result.transactionsMatched++;
    }

    return result;
  }

  private addIssue(
    result: AccountMatchingResult,
    envelope: ParsedMailTransactionEnvelope,
    code: AccountMatchingIssueCode,
    candidateAccountIds: string[],
  ): void {
    result.transactionsUnmatched++;
    result.issues.push({
      messageId: envelope.messageId,
      parserKey: envelope.parserKey,
      parserVersion: envelope.parserVersion,
      code,
      institutionId: envelope.transaction.institutionId,
      accountType: envelope.transaction.accountType,
      accountLast4: envelope.transaction.accountLast4,
      candidateAccountIds,
    });
  }

  private normalizeLast4(value?: string): string | undefined {
    const normalized = value?.trim();
    return normalized && /^\d{4}$/.test(normalized) ? normalized : undefined;
  }
}
