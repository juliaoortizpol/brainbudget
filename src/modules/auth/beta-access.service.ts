import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class BetaAccessService {
  private readonly isBeta: boolean;
  private readonly allowedEmails: Set<string>;

  constructor(configService: ConfigService) {
    this.isBeta =
      configService.get<string>('APP_ENV')?.trim().toLowerCase() === 'beta';
    const configuredEmails = configService.get<string>('BETA_ALLOWED_EMAILS');
    const emails = configuredEmails ? configuredEmails.split(',') : [];

    this.allowedEmails = new Set(
      emails.map((email) => this.normalize(email)).filter(Boolean),
    );
  }

  assertAllowed(email?: string): void {
    if (!this.isBeta) return;

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
