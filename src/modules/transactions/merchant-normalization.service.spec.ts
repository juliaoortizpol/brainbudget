import { MerchantNormalizationService } from './merchant-normalization.service';

describe('MerchantNormalizationService', () => {
  const service = new MerchantNormalizationService();

  it.each([
    ['UBER *TRIP HELP.UBER.COM', 'uber'],
    ['NETFLIX.COM 866-579-7172', 'netflix'],
    ['UBER EATS', 'uber eats'],
    ['  Uber   Eats \t\n', 'uber eats'],
    ['CAFÉ, MARKET! / STORE #42', 'café market store 42'],
    ['WWW.NETFLIX.COM (866) 579-7172', 'netflix'],
    ['', ''],
    ['  ***  ', ''],
  ])('normalizes %j to %j', (input, expected) => {
    expect(service.normalize(input)).toBe(expected);
    expect(service.normalize(expected)).toBe(expected);
  });
});
