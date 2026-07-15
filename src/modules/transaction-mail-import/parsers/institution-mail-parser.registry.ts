import { Injectable } from '@nestjs/common';
import { InstitutionMailParser } from '../contracts';

@Injectable()
export class InstitutionMailParserRegistry {
  private readonly parsers = new Map<string, InstitutionMailParser>();

  register(parser: InstitutionMailParser): void {
    const key = this.getRegistryKey(parser.parserKey, parser.version);
    if (this.parsers.has(key)) {
      throw new Error(`Parser '${key}' is already registered`);
    }
    this.parsers.set(key, parser);
  }

  get(parserKey: string, version: number): InstitutionMailParser | undefined {
    return this.parsers.get(this.getRegistryKey(parserKey, version));
  }

  has(parserKey: string, version: number): boolean {
    return this.parsers.has(this.getRegistryKey(parserKey, version));
  }

  private getRegistryKey(parserKey: string, version: number): string {
    return `${parserKey}@${version}`;
  }
}
