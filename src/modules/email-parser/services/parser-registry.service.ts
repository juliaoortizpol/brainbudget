import { Injectable, Logger } from '@nestjs/common';
import { ParserFunction } from '../parsers/types';
import { ALL_PARSERS } from '../parsers';

@Injectable()
export class ParserRegistryService {
  private readonly logger = new Logger(ParserRegistryService.name);
  private parsers: Map<string, ParserFunction> = new Map();

  constructor() {
    this.registerAllParsers();
  }

  private registerAllParsers() {
    for (const parserDef of ALL_PARSERS) {
      this.logger.debug(`Registering parser: ${parserDef.id}`);
      this.parsers.set(parserDef.id, parserDef.parse);
    }
    this.logger.log(`Registered ${ALL_PARSERS.length} email parsers.`);
  }

  getParser(parserCodeId: string): ParserFunction | undefined {
    return this.parsers.get(parserCodeId);
  }

  registerParser(parserCodeId: string, parserFn: ParserFunction) {
    this.parsers.set(parserCodeId, parserFn);
  }
}
