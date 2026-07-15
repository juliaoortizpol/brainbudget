import { InstitutionMailParserRegistry } from '../institution-mail-parser.registry';
import { QikCreditCardMailParser } from './qik-credit-card-mail.parser';
import {
  qikCreditCardMessageFixture,
  qikCreditCardRuleFixture,
} from './fixtures/qik-credit-card.fixture';

describe('QikCreditCardMailParser', () => {
  const parser = new QikCreditCardMailParser();

  it('parses the sanitized Qik credit-card purchase fixture', () => {
    expect(
      parser.canParse(qikCreditCardMessageFixture, qikCreditCardRuleFixture),
    ).toBe(true);
    expect(
      parser.parse(qikCreditCardMessageFixture, qikCreditCardRuleFixture),
    ).toEqual([
      {
        institutionId: 'qik-institution-id',
        accountType: 'credit_card',
        accountLast4: '6747',
        amount: 611.63,
        currency: 'DOP',
        type: 'expense',
        description: 'APPLE.COM/BILL',
        transactionDate: new Date('2026-07-13T04:09:00.000Z'),
      },
    ]);
  });

  it('does not use the available balance as the transaction amount', () => {
    const [transaction] = parser.parse(
      qikCreditCardMessageFixture,
      qikCreditCardRuleFixture,
    );
    expect(transaction.amount).not.toBe(2144.37);
  });

  it('rejects an incomplete template', () => {
    expect(
      parser.parse(
        {
          ...qikCreditCardMessageFixture,
          body: '<p>Tarjeta 53*************6747</p>',
        },
        qikCreditCardRuleFixture,
      ),
    ).toEqual([]);
  });

  it('can be registered under qik.credit-card version 1', () => {
    const registry = new InstitutionMailParserRegistry();
    registry.register(parser);
    expect(registry.get('qik.credit-card', 1)).toBe(parser);
  });
});
