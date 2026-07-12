import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google } from 'googleapis';

@Injectable()
export class GmailClientFactory {
  constructor(private readonly configService: ConfigService) {}

  createOAuthClient() {
    return new google.auth.OAuth2(
      this.configService.get<string>('GOOGLE_CLIENT_ID'),
      this.configService.get<string>('GOOGLE_CLIENT_SECRET'),
      this.configService.get<string>('GMAIL_READER_REDIRECT_URI') ||
        'http://localhost:3000/gmail-reader/oauth/callback',
    );
  }

  createGmailClient(refreshToken: string) {
    const oauthClient = this.createOAuthClient();
    oauthClient.setCredentials({ refresh_token: refreshToken });
    return google.gmail({ version: 'v1', auth: oauthClient });
  }
}
