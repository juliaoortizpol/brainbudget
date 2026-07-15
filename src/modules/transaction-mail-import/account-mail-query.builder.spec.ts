import { AccountMailQueryBuilder } from './account-mail-query.builder';
import { MailImportContext } from './contracts';

describe('AccountMailQueryBuilder', () => {
  const builder = new AccountMailQueryBuilder();

  const context: MailImportContext = {
    userId: 'user-1',
    supportedAccounts: [
      {
        accountId: 'account-1',
        accountName: 'Banreservas Card',
        institutionId: 'institution-1',
        institutionName: 'Banreservas',
        accountType: 'credit_card',
      },
      {
        accountId: 'account-2',
        accountName: 'Popular Card',
        institutionId: 'institution-2',
        institutionName: 'Banco Popular',
        accountType: 'credit_card',
      },
    ],
    unsupportedAccounts: [],
    rules: [
      {
        institutionId: 'institution-1',
        institutionName: 'Banreservas',
        senderAddresses: [
          ' Notificaciones@Banreservas.com ',
          'shared@alerts.test',
        ],
        subjectKeywords: ['Consumo'],
        parserKey: 'banreservas.credit-card',
        parserVersion: 1,
        accountType: 'credit_card',
      },
      {
        institutionId: 'institution-2',
        institutionName: 'Banco Popular',
        senderAddresses: ['alertas@popular.com.do', 'shared@alerts.test'],
        subjectKeywords: ['Alerta de consumo'],
        parserKey: 'popular.credit-card',
        parserVersion: 1,
        accountType: 'credit_card',
      },
    ],
  };

  it('builds one query with normalized and deduplicated senders', () => {
    expect(builder.buildMailQueryForUserAccounts(context)).toEqual({
      query:
        '{from:alertas@popular.com.do OR from:notificaciones@banreservas.com OR from:shared@alerts.test} newer_than:30d',
      senderAddresses: [
        'alertas@popular.com.do',
        'notificaciones@banreservas.com',
        'shared@alerts.test',
      ],
      supportedAccountIds: ['account-1', 'account-2'],
    });
  });

  it('supports an explicit synchronization cursor', () => {
    const after = new Date('2026-07-15T12:00:00.000Z');
    const result = builder.buildMailQueryForUserAccounts(context, { after });

    expect(result.query).toBe(
      `{from:alertas@popular.com.do OR from:notificaciones@banreservas.com OR from:shared@alerts.test} after:${Math.floor(
        after.getTime() / 1000,
      )}`,
    );
  });

  it('returns a null query when no institution has mail rules', () => {
    const result = builder.buildMailQueryForUserAccounts({
      ...context,
      rules: [],
      supportedAccounts: [],
    });

    expect(result).toEqual({
      query: null,
      senderAddresses: [],
      supportedAccountIds: [],
    });
  });

  it('rejects ambiguous date options', () => {
    expect(() =>
      builder.buildMailQueryForUserAccounts(context, {
        after: new Date(),
        newerThanDays: 7,
      }),
    ).toThrow('Use either after or newerThanDays, not both');
  });
});
