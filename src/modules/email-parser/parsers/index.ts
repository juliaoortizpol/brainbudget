import { chaseCreditCardParser } from './chase/chase-credit-card.parser';
import { banreservasCreditCardParser } from './banreservas/banreservas-credit-card.parser';

export const ALL_PARSERS = [
  chaseCreditCardParser,
  banreservasCreditCardParser,
];
