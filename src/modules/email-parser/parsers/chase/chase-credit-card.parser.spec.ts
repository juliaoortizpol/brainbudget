import { chaseCreditCardParser } from './chase-credit-card.parser';

describe('chaseCreditCardParser', () => {
  it('parses a positive dollar amount', () => {
    expect(
      chaseCreditCardParser.parse(
        'You spent $1,234.56 at Example Store',
        'Card alert',
      ),
    ).toMatchObject({
      amount: 1234.56,
      type: 'expense',
      accountType: 'credit_card',
    });
  });

  it('rejects an email without an amount', () => {
    expect(
      chaseCreditCardParser.parse('General account notice', 'Notice'),
    ).toBeNull();
  });
});
