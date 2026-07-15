import { InstitutionMailParser } from '../contracts';
import { InstitutionMailParserRegistry } from './institution-mail-parser.registry';

describe('InstitutionMailParserRegistry', () => {
  it('registers and resolves a parser by key and version', () => {
    const registry = new InstitutionMailParserRegistry();
    const parser = {
      parserKey: 'bank.credit-card',
      version: 1,
    } as InstitutionMailParser;

    registry.register(parser);

    expect(registry.get('bank.credit-card', 1)).toBe(parser);
    expect(registry.has('bank.credit-card', 1)).toBe(true);
  });

  it('rejects duplicate parser registrations', () => {
    const registry = new InstitutionMailParserRegistry();
    const parser = {
      parserKey: 'bank.credit-card',
      version: 1,
    } as InstitutionMailParser;
    registry.register(parser);

    expect(() => registry.register(parser)).toThrow(
      "Parser 'bank.credit-card@1' is already registered",
    );
  });
});
