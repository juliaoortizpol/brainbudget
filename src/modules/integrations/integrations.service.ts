import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { google } from 'googleapis';
import { createHmac, timingSafeEqual } from 'crypto';
import {
  GmailConnection,
  GmailConnectionDocument,
} from './schemas/gmail-connection.schema';

@Injectable()
export class IntegrationsService {
  private oauth2Client;

  constructor(
    @InjectModel(GmailConnection.name)
    private gmailConnectionModel: Model<GmailConnectionDocument>,
  ) {
    // These should ideally come from ConfigService
    const clientId = process.env.GOOGLE_CLIENT_ID || 'dummy-client-id';
    const clientSecret =
      process.env.GOOGLE_CLIENT_SECRET || 'dummy-client-secret';
    const redirectUri =
      process.env.GOOGLE_REDIRECT_URI ||
      'http://localhost:3000/integrations/gmail/callback';

    this.oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri,
    );
  }

  getGmailAuthUrl(userId: string): string {
    // Generate an OAuth URL asking for Gmail read-only access.
    // We pass the userId in the state parameter so we can save the token for the right user on callback.
    const scopes = [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/userinfo.email',
    ];

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline', // Required to get a refresh token
      prompt: 'consent', // Forces Google to issue a new refresh token
      scope: scopes,
      state: this.createOAuthState(userId),
    });
  }

  async handleGmailCallback(code: string, state: string) {
    try {
      const userId = this.verifyOAuthState(state);
      const { tokens } = await this.oauth2Client.getToken(code);
      this.oauth2Client.setCredentials(tokens);

      // Fetch user's email address using the access token
      const oauth2 = google.oauth2({ version: 'v2', auth: this.oauth2Client });
      const userInfo = await oauth2.userinfo.get();
      const email = userInfo.data.email;

      if (!email) {
        throw new InternalServerErrorException(
          'Could not retrieve email from Google',
        );
      }

      // Upsert the connection in the database
      const values: Record<string, string> = {
        email,
        status: 'active',
      };
      if (tokens.refresh_token) {
        values.refreshToken = tokens.refresh_token;
      }

      const connection = await this.gmailConnectionModel
        .findOneAndUpdate(
          { userId: new Types.ObjectId(userId) },
          { $set: values },
          { new: true, upsert: true },
        )
        .exec();

      return connection;
    } catch (error: any) {
      throw new InternalServerErrorException(
        `Failed to connect Gmail: ${error.message}`,
      );
    }
  }

  private createOAuthState(userId: string): string {
    const payload = `${userId}.${Date.now()}`;
    const signature = createHmac('sha256', this.getStateSecret())
      .update(payload)
      .digest('hex');
    return Buffer.from(`${payload}.${signature}`).toString('base64url');
  }

  private verifyOAuthState(state: string): string {
    const decoded = Buffer.from(state, 'base64url').toString('utf8');
    const [userId, issuedAtValue, signature] = decoded.split('.');
    const issuedAt = Number(issuedAtValue);
    const payload = `${userId}.${issuedAtValue}`;
    const expected = createHmac('sha256', this.getStateSecret())
      .update(payload)
      .digest('hex');

    if (
      !Types.ObjectId.isValid(userId) ||
      !Number.isFinite(issuedAt) ||
      Date.now() - issuedAt > 10 * 60 * 1000 ||
      Date.now() < issuedAt ||
      signature?.length !== expected.length ||
      !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
    ) {
      throw new InternalServerErrorException('Invalid or expired OAuth state');
    }

    return userId;
  }

  private getStateSecret(): string {
    return (
      process.env.GOOGLE_STATE_SECRET ||
      process.env.GOOGLE_CLIENT_SECRET ||
      'development-state-secret'
    );
  }

  async getGmailConnection(userId: string) {
    return this.gmailConnectionModel
      .findOne({ userId: new Types.ObjectId(userId) })
      .exec();
  }

  async disconnectGmail(userId: string) {
    const connection = await this.gmailConnectionModel
      .findOneAndUpdate(
        { userId: new Types.ObjectId(userId) },
        { $set: { status: 'disconnected', refreshToken: null } },
        { new: true },
      )
      .exec();
    return connection;
  }

  async fetchRecentMails(userId: string, query: string = 'newer_than:5d') {
    const connection = await this.getGmailConnection(userId);

    if (
      !connection ||
      connection.status !== 'active' ||
      !connection.refreshToken
    ) {
      throw new InternalServerErrorException(
        'Gmail is not connected or missing refresh token',
      );
    }

    try {
      this.oauth2Client.setCredentials({
        refresh_token: connection.refreshToken,
      });
      const gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });

      // List messages matching the query
      const listResponse = await gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults: 10, // Limit to 10 for testing
      });

      const messages = listResponse.data.messages || [];
      if (messages.length === 0) {
        return [];
      }

      // Fetch the full content of each message
      const mailDetails = await Promise.all(
        messages.map(async (msg) => {
          const msgResponse = await gmail.users.messages.get({
            userId: 'me',
            id: msg.id!,
            format: 'metadata',
            metadataHeaders: ['From', 'Subject', 'Date'],
          });

          const headers = msgResponse.data.payload?.headers || [];
          const subject =
            headers.find((h) => h.name === 'Subject')?.value || 'No Subject';
          const from =
            headers.find((h) => h.name === 'From')?.value || 'Unknown Sender';
          const date = headers.find((h) => h.name === 'Date')?.value || '';

          return {
            id: msg.id,
            snippet: msgResponse.data.snippet,
            subject,
            from,
            date,
          };
        }),
      );

      return mailDetails;
    } catch (error: any) {
      throw new InternalServerErrorException(
        `Failed to fetch emails: ${error.message}`,
      );
    }
  }
}
