import {
  AccountMatchingIssueCode,
  MailImportAccount,
  ParsedMailTransactionEnvelope,
} from './contracts';
import { TransactionMailAccountMatcher } from './transaction-mail-account.matcher';

describe('TransactionMailAccountMatcher', () => {
  const matcher = new TransactionMailAccountMatcher();
  const account: MailImportAccount = {
    accountId: 'account-1',
    accountName: 'Qik Credit Card',
    institutionName: 'Qik',
    institutionId: 'qik-institution',
    accountType: 'credit_card',
    last4Digits: '6747',
  };
  const envelope: ParsedMailTransactionEnvelope = {
    messageId: 'message-1',
    parserKey: 'qik.credit-card',
    parserVersion: 1,
    transaction: {
      institutionId: 'qik-institution',
      accountType: 'credit_card',
      accountLast4: '6747',
      amount: 611.63,
      currency: 'DOP',
      type: 'expense',
      description: 'APPLE.COM/BILL',
      transactionDate: new Date('2026-07-13T04:09:00.000Z'),
    },
  };

  it('matches a transaction to one account by institution, type and last4', () => {
    const result = matcher.match(
      [envelope],
      [
        account,
        {
          ...account,
          accountId: 'account-2',
          accountType: 'savings',
        },
      ],
    );

    expect(result).toEqual({
      transactionsReviewed: 1,
      transactionsMatched: 1,
      transactionsUnmatched: 0,
      transactions: [{ ...envelope, accountId: 'account-1' }],
      issues: [],
    });
  });

  it('does not match when the parsed transaction has no last4', () => {
    const result = matcher.match(
      [
        {
          ...envelope,
          transaction: { ...envelope.transaction, accountLast4: undefined },
        },
      ],
      [account],
    );

    expect(result.transactions).toEqual([]);
    expect(result.issues).toEqual([
      expect.objectContaining({
        code: AccountMatchingIssueCode.ACCOUNT_LAST4_MISSING,
        candidateAccountIds: ['account-1'],
      }),
    ]);
  });

  it('reports when no account has the parsed last4', () => {
    const result = matcher.match(
      [envelope],
      [{ ...account, last4Digits: '9999' }],
    );

    expect(result.issues[0]).toMatchObject({
      code: AccountMatchingIssueCode.ACCOUNT_NOT_FOUND,
      candidateAccountIds: [],
    });
  });

  it('rejects ambiguous matches instead of choosing an account', () => {
    const result = matcher.match(
      [envelope],
      [account, { ...account, accountId: 'account-2' }],
    );

    expect(result.transactions).toEqual([]);
    expect(result.issues[0]).toMatchObject({
      code: AccountMatchingIssueCode.AMBIGUOUS_ACCOUNT,
      candidateAccountIds: ['account-1', 'account-2'],
    });
  });
});
