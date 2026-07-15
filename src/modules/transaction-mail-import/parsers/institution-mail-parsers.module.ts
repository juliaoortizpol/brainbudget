import { Module } from '@nestjs/common';
import { InstitutionMailParserRegistry } from './institution-mail-parser.registry';
import { InstitutionMailParsingService } from './institution-mail-parsing.service';

@Module({
  providers: [InstitutionMailParserRegistry, InstitutionMailParsingService],
  exports: [InstitutionMailParserRegistry, InstitutionMailParsingService],
})
export class InstitutionMailParsersModule {}
