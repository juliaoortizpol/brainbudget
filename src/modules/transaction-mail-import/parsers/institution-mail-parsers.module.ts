import { Module } from '@nestjs/common';
import { InstitutionMailParserRegistry } from './institution-mail-parser.registry';
import { InstitutionMailParsingService } from './institution-mail-parsing.service';
import { QikCreditCardMailParser } from './qik/qik-credit-card-mail.parser';

@Module({
  providers: [
    QikCreditCardMailParser,
    {
      provide: InstitutionMailParserRegistry,
      useFactory: (qikParser: QikCreditCardMailParser) => {
        const registry = new InstitutionMailParserRegistry();
        registry.register(qikParser);
        return registry;
      },
      inject: [QikCreditCardMailParser],
    },
    InstitutionMailParsingService,
  ],
  exports: [InstitutionMailParserRegistry, InstitutionMailParsingService],
})
export class InstitutionMailParsersModule {}
