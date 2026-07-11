import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { InstitutionConfig, InstitutionConfigSchema } from './schemas/institution-config.schema';
import { EmailParserService } from './services/email-parser.service';
import { ParserRegistryService } from './services/parser-registry.service';
import { EmailParserController } from './email-parser.controller';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: InstitutionConfig.name, schema: InstitutionConfigSchema }]),
  ],
  controllers: [EmailParserController],
  providers: [ParserRegistryService, EmailParserService],
  exports: [EmailParserService],
})
export class EmailParserModule {}
