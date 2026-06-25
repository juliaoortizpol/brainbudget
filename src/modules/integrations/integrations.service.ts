import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { google } from 'googleapis';
import { GmailConnection, GmailConnectionDocument } from './schemas/gmail-connection.schema';

@Injectable()
export class IntegrationsService {
  private oauth2Client;

  constructor(
    @InjectModel(GmailConnection.name) private gmailConnectionModel: Model<GmailConnectionDocument>,
  ) {
    // These should ideally come from ConfigService
    const clientId = process.env.GOOGLE_CLIENT_ID || 'dummy-client-id';
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET || 'dummy-client-secret';
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/integrations/gmail/callback';

    this.oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri
    );
  }

  getGmailAuthUrl(userId: string): string {
    // Generate an OAuth URL asking for Gmail read-only access.
    // We pass the userId in the state parameter so we can save the token for the right user on callback.
    const scopes = [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/userinfo.email'
    ];

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline', // Required to get a refresh token
      prompt: 'consent',      // Forces Google to issue a new refresh token
      scope: scopes,
      state: userId,
    });
  }

  async handleGmailCallback(code: string, userId: string) {
    try {
      const { tokens } = await this.oauth2Client.getToken(code);
      this.oauth2Client.setCredentials(tokens);

      // Fetch user's email address using the access token
      const oauth2 = google.oauth2({ version: 'v2', auth: this.oauth2Client });
      const userInfo = await oauth2.userinfo.get();
      const email = userInfo.data.email;

      if (!email) {
        throw new InternalServerErrorException('Could not retrieve email from Google');
      }

      // Upsert the connection in the database
      const connection = await this.gmailConnectionModel.findOneAndUpdate(
        { userId: new Types.ObjectId(userId) },
        {
          $set: {
            email,
            status: 'active',
          },
          // Only update refreshToken if a new one was provided
          ...(tokens.refresh_token && { $set: { refreshToken: tokens.refresh_token } }),
        },
        { new: true, upsert: true }
      ).exec();

      return connection;
    } catch (error: any) {
      throw new InternalServerErrorException(`Failed to connect Gmail: ${error.message}`);
    }
  }

  async getGmailConnection(userId: string) {
    return this.gmailConnectionModel.findOne({ userId: new Types.ObjectId(userId) }).exec();
  }

  async disconnectGmail(userId: string) {
    const connection = await this.gmailConnectionModel.findOneAndUpdate(
      { userId: new Types.ObjectId(userId) },
      { $set: { status: 'disconnected', refreshToken: null } },
      { new: true }
    ).exec();
    return connection;
  }
}
