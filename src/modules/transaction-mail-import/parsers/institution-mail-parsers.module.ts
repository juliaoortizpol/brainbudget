import { Module } from '@nestjs/common';
import { InstitutionMailParserRegistry } from './institution-mail-parser.registry';
import { InstitutionMailParsingService } from './institution-mail-parsing.service';
import { ApapCreditCardMailParser } from './apap/apap-credit-card-mail.parser';
import { QikCreditCardMailParser } from './qik/qik-credit-card-mail.parser';

@Module({
  providers: [
    ApapCreditCardMailParser,
    QikCreditCardMailParser,
    {
      provide: InstitutionMailParserRegistry,
      useFactory: (
        apapParser: ApapCreditCardMailParser,
        qikParser: QikCreditCardMailParser,
      ) => {
        const registry = new InstitutionMailParserRegistry();
        registry.register(apapParser);
        registry.register(qikParser);
        return registry;
      },
      inject: [ApapCreditCardMailParser, QikCreditCardMailParser],
    },
    InstitutionMailParsingService,
  ],
  exports: [InstitutionMailParserRegistry, InstitutionMailParsingService],
})
export class InstitutionMailParsersModule {}
