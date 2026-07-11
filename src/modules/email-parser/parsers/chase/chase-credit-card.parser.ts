import { ParserDefinition } from '../types';
import { Logger } from '@nestjs/common';

const logger = new Logger('ChaseCreditCardParser');

export const chaseCreditCardParser: ParserDefinition = {
  id: 'chase_credit_card_v1',
  parse: (body: string, subject: string) => {
    logger.debug('Executing chase_credit_card_v1 parser');
    try {
      // Very basic mock parsing logic for demonstration
      const amountMatch = body.match(/\$([0-9,.]+)/);
      if (!amountMatch) return null;
      const amount = parseFloat(amountMatch[1].replace(/,/g, ''));
      if (!Number.isFinite(amount) || amount <= 0) return null;

      return {
        amount,
        date: new Date(),
        description: 'Chase Credit Card Transaction',
        type: 'expense',
        accountType: 'credit_card',
      };
    } catch (error) {
      logger.error('Failed to parse with chase_credit_card_v1', error);
      return null;
    }
  },
};
