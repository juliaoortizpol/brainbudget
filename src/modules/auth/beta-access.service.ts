import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const DEFAULT_BETA_EMAILS = [
  'julioortizpol@gmail.com',
  'gabrielasilvestre847@gmail.com',
];

@Injectable()
export class BetaAccessService {
  private readonly allowedEmails: Set<string>;

  constructor(configService: ConfigService) {
    const configuredEmails = configService.get<string>('BETA_ALLOWED_EMAILS');
    const emails = configuredEmails
      ? configuredEmails.split(',')
      : DEFAULT_BETA_EMAILS;

    this.allowedEmails = new Set(
      emails.map((email) => this.normalize(email)).filter(Boolean),
    );
  }

  assertAllowed(email?: string): void {
    if (!email || !this.allowedEmails.has(this.normalize(email))) {
      throw new ForbiddenException(
        'This application is currently available by invitation only.',
      );
    }
  }

  private normalize(email: string): string {
    return email.trim().toLowerCase();
  }
}
