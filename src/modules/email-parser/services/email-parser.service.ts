import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { InstitutionConfig, InstitutionConfigDocument } from '../schemas/institution-config.schema';
import { ParserRegistryService } from './parser-registry.service';

@Injectable()
export class EmailParserService {
  private readonly logger = new Logger(EmailParserService.name);

  constructor(
    @InjectModel(InstitutionConfig.name) private institutionConfigModel: Model<InstitutionConfigDocument>,
    private readonly parserRegistry: ParserRegistryService,
  ) {}

  async getActiveConfigs(): Promise<InstitutionConfig[]> {
    return this.institutionConfigModel.find().exec();
  }

  async parseEmail(senderEmail: string, subject: string, body: string) {
    this.logger.debug(`Attempting to parse email from: ${senderEmail} with subject: ${subject}`);
    
    // 1. Fetch all configs
    const configs = await this.getActiveConfigs();
    
    // 2. Find a matching parsing rule
    for (const config of configs) {
      for (const rule of config.parsingRules) {
        // Check if sender matches and subject contains keywords
        const isSenderMatch = rule.senderEmail.toLowerCase() === senderEmail.toLowerCase();
        const isSubjectMatch = rule.subjectKeywords.some(keyword => subject.toLowerCase().includes(keyword.toLowerCase()));

        if (isSenderMatch && isSubjectMatch) {
          this.logger.debug(`Found matching rule in Institution: ${config.name} for Account Type: ${rule.accountType}`);
          
          // 3. Get the registered parser function
          const parserFn = this.parserRegistry.getParser(rule.parserCodeId);
          if (!parserFn) {
            this.logger.error(`Parser with ID ${rule.parserCodeId} not found in registry.`);
            continue;
          }

          // 4. Execute parser
          const result = parserFn(body, subject);
          if (result) {
            return {
              institutionName: config.name,
              accountType: rule.accountType,
              transaction: result,
            };
          }
        }
      }
    }
    
    this.logger.warn('No matching parsing rule or successful parse found for this email.');
    return null;
  }

  // Utility to seed some initial configurations for testing
  async seedTestConfig() {
    const existing = await this.institutionConfigModel.findOne({ name: 'Chase Bank' });
    if (!existing) {
      await this.institutionConfigModel.create({
        name: 'Chase Bank',
        parsingRules: [
          {
            accountType: 'credit',
            senderEmail: 'alerts@chase.com',
            subjectKeywords: ['Your credit card', 'transaction'],
            parserCodeId: 'chase_credit_card_v1'
          }
        ]
      });
    }

    const banreservas = await this.institutionConfigModel.findOne({ name: 'Banreservas' });
    if (!banreservas) {
      await this.institutionConfigModel.create({
        name: 'Banreservas',
        parsingRules: [
          {
            accountType: 'credit',
            senderEmail: 'JULIO5001@hotmail.com',
            subjectKeywords: ['Notificaciones Banreservas', 'Consumo'],
            parserCodeId: 'banreservas_tc_v1'
          }
        ]
      });
    }

    return { message: 'Seed complete' };
  }
}
