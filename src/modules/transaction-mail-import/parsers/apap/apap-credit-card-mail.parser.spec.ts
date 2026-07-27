import { InstitutionMailParserRegistry } from '../institution-mail-parser.registry';
import { ApapCreditCardMailParser } from './apap-credit-card-mail.parser';
import {
  apapCreditCardMessageFixture,
  apapCreditCardRuleFixture,
} from './fixtures/apap-credit-card.fixture';

describe('ApapCreditCardMailParser', () => {
  const parser = new ApapCreditCardMailParser();

  it('parses an approved APAP credit-card purchase', () => {
    expect(
      parser.canParse(apapCreditCardMessageFixture, apapCreditCardRuleFixture),
    ).toBe(true);
    expect(
      parser.parse(apapCreditCardMessageFixture, apapCreditCardRuleFixture),
    ).toEqual([
      {
        institutionId: 'apap-institution-id',
        accountType: 'credit_card',
        accountLast4: '2324',
        amount: 129.79,
        currency: 'DOP',
        type: 'expense',
        description: 'UBER RIDES-W*UBER RIDE',
        transactionDate: new Date('2026-07-26T14:25:00.000Z'),
      },
    ]);
  });

  it('does not use the available balance as the transaction amount', () => {
    const [transaction] = parser.parse(
      apapCreditCardMessageFixture,
      apapCreditCardRuleFixture,
    );
    expect(transaction.amount).not.toBe(78355.72);
  });

  it('rejects a transaction that is not approved', () => {
    const message = {
      ...apapCreditCardMessageFixture,
      body: apapCreditCardMessageFixture.body.replace('APROBADA', 'RECHAZADA'),
    };
    expect(parser.parse(message, apapCreditCardRuleFixture)).toEqual([]);
  });

  it('rejects an incomplete template', () => {
    expect(
      parser.parse(
        {
          ...apapCreditCardMessageFixture,
          body: '<p>Tarjeta APAP terminada en 2324</p>',
        },
        apapCreditCardRuleFixture,
      ),
    ).toEqual([]);
  });

  it('can be registered under apap.credit-card version 1', () => {
    const registry = new InstitutionMailParserRegistry();
    registry.register(parser);
    expect(registry.get('apap.credit-card', 1)).toBe(parser);
  });
});
