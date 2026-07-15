import { GmailMessage } from '@/modules/gmail-reader/gmail-reader.types';
import {
  InstitutionMailParser,
  MailImportRule,
  MailParsingIssueCode,
} from '../contracts';
import { InstitutionMailParserRegistry } from './institution-mail-parser.registry';
import { InstitutionMailParsingService } from './institution-mail-parsing.service';

describe('InstitutionMailParsingService', () => {
  const rule: MailImportRule = {
    institutionId: 'institution-1',
    institutionName: 'Test Bank',
    senderAddresses: ['alerts@testbank.dev'],
    subjectKeywords: ['Transaction alert'],
    parserKey: 'test-bank.credit-card',
    parserVersion: 1,
    accountType: 'credit_card',
  };
  const matchingMessage = {
    id: 'message-1',
    from: 'Test Bank <alerts@testbank.dev>',
    to: ['user@example.com'],
    subject: 'Your Transaction Alert',
    snippet: '',
    body: '<p>Purchase</p>',
    mimeType: 'text/html',
  } satisfies GmailMessage;

  it('matches a message and returns normalized parser results', async () => {
    const registry = new InstitutionMailParserRegistry();
    const parser: InstitutionMailParser = {
      parserKey: rule.parserKey,
      version: rule.parserVersion,
      canParse: jest.fn().mockReturnValue(true),
      parse: jest.fn().mockReturnValue([
        {
          institutionId: rule.institutionId,
          accountType: 'credit_card',
          accountLast4: '1234',
          amount: 100,
          currency: 'DOP',
          type: 'expense',
          description: 'Purchase',
          transactionDate: new Date('2026-07-15T12:00:00Z'),
        },
      ]),
    };
    registry.register(parser);
    const service = new InstitutionMailParsingService(registry);

    const result = await service.parseMails(
      [
        matchingMessage,
        {
          ...matchingMessage,
          id: 'message-2',
          from: 'someone@example.com',
        },
      ],
      [rule],
    );

    expect(result).toMatchObject({
      messagesReviewed: 2,
      messagesParsed: 1,
      messagesIgnored: 1,
      messagesFailed: 0,
    });
    expect(result.transactions).toEqual([
      expect.objectContaining({
        messageId: 'message-1',
        parserKey: rule.parserKey,
        parserVersion: 1,
        transaction: expect.objectContaining({ amount: 100 }),
      }),
    ]);
  });

  it('reports a rule whose parser is not registered', async () => {
    const service = new InstitutionMailParsingService(
      new InstitutionMailParserRegistry(),
    );

    const result = await service.parseMails([matchingMessage], [rule]);

    expect(result.messagesFailed).toBe(1);
    expect(result.issues).toEqual([
      {
        messageId: 'message-1',
        code: MailParsingIssueCode.PARSER_NOT_REGISTERED,
        parserKey: rule.parserKey,
        parserVersion: 1,
      },
    ]);
  });

  it('isolates parser failures to the affected message', async () => {
    const registry = new InstitutionMailParserRegistry();
    registry.register({
      parserKey: rule.parserKey,
      version: rule.parserVersion,
      canParse: () => true,
      parse: () => {
        throw new Error('Invalid template');
      },
    });
    const service = new InstitutionMailParsingService(registry);

    const result = await service.parseMails([matchingMessage], [rule]);

    expect(result.messagesFailed).toBe(1);
    expect(result.issues[0]).toMatchObject({
      messageId: 'message-1',
      code: MailParsingIssueCode.PARSER_FAILED,
    });
  });
});
