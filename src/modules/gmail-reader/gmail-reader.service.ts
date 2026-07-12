import {
  BadGatewayException,
  Injectable,
  NotFoundException,
  HttpStatus,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { createHmac, timingSafeEqual } from 'crypto';
import { Model, Types } from 'mongoose';
import { GmailClientFactory } from './gmail-client.factory';
import { mapGmailMessage } from './gmail-message.mapper';
import { ListGmailMessagesDto } from './dto/list-gmail-messages.dto';
import {
  GmailReaderConnection,
  GmailReaderConnectionDocument,
} from './schemas/gmail-reader-connection.schema';
import { GmailMessage, GmailMessagePage } from './gmail-reader.types';
import {
  GmailReaderErrorCode,
  GmailReaderException,
} from './gmail-reader.errors';

@Injectable()
export class GmailReaderService {
  constructor(
    @InjectModel(GmailReaderConnection.name)
    private readonly connectionModel: Model<GmailReaderConnectionDocument>,
    private readonly clientFactory: GmailClientFactory,
    private readonly configService: ConfigService,
  ) {}

  getAuthorizationUrl(userId: string): string {
    const client = this.clientFactory.createOAuthClient();
    return client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: [
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/userinfo.email',
      ],
      state: this.createState(userId),
    });
  }

  async connectFromCallback(code: string, state: string) {
    const userId = this.verifyState(state);
    const oauthClient = this.clientFactory.createOAuthClient();

    try {
      const { tokens } = await oauthClient.getToken(code);
      oauthClient.setCredentials(tokens);
      const profile = await oauthClient.getTokenInfo(tokens.access_token || '');
      const email = profile.email;
      if (!email) throw new Error('Google did not return an email address');

      const existing = await this.connectionModel
        .findOne({ userId: new Types.ObjectId(userId) })
        .select('+refreshToken')
        .exec();
      const refreshToken = tokens.refresh_token || existing?.refreshToken;
      if (!refreshToken)
        throw new Error('Google did not return a refresh token');

      await this.connectionModel.updateOne(
        { userId: new Types.ObjectId(userId) },
        { $set: { email, refreshToken, status: 'active' } },
        { upsert: true },
      );
      return { connected: true, email };
    } catch (error: any) {
      throw new BadGatewayException(
        `Could not connect Gmail: ${error.message}`,
      );
    }
  }

  async getStatus(userId: string) {
    const connection = await this.connectionModel
      .findOne({ userId: new Types.ObjectId(userId) })
      .exec();
    return connection
      ? {
          connected: connection.status === 'active',
          email: connection.email,
          status: connection.status,
          lastReadAt: connection.lastReadAt,
        }
      : { connected: false };
  }

  async disconnect(userId: string) {
    const connection = await this.connectionModel
      .findOneAndUpdate(
        { userId: new Types.ObjectId(userId) },
        { $set: { status: 'disconnected' }, $unset: { refreshToken: 1 } },
        { new: true },
      )
      .exec();
    if (!connection) throw new NotFoundException('Gmail connection not found');
    return { connected: false };
  }

  async listMessages(
    userId: string,
    options: ListGmailMessagesDto,
  ): Promise<GmailMessagePage> {
    const { gmail, connection } = await this.getAuthorizedClient(userId);
    try {
      const page = await gmail.users.messages.list({
        userId: 'me',
        q: options.query,
        maxResults: options.maxResults,
        pageToken: options.pageToken,
      });
      const messages = await Promise.all(
        (page.data.messages || []).map(async ({ id }) => {
          if (!id) return null;
          const response = await gmail.users.messages.get({
            userId: 'me',
            id,
            format: options.includeBody ? 'full' : 'metadata',
            metadataHeaders: options.includeBody
              ? undefined
              : ['From', 'To', 'Subject', 'Date'],
          });
          return mapGmailMessage(response.data, options.includeBody);
        }),
      );
      connection.lastReadAt = new Date();
      await connection.save();
      return {
        messages: messages.filter(
          (message): message is GmailMessage => message !== null,
        ),
        nextPageToken: page.data.nextPageToken || undefined,
        resultSizeEstimate: page.data.resultSizeEstimate || 0,
      };
    } catch (error: any) {
      return this.handleReadError(
        userId,
        error,
        'Could not read Gmail messages',
      );
    }
  }

  async getMessage(userId: string, messageId: string): Promise<GmailMessage> {
    const { gmail, connection } = await this.getAuthorizedClient(userId);
    try {
      const response = await gmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'full',
      });
      connection.lastReadAt = new Date();
      await connection.save();
      return mapGmailMessage(response.data, true);
    } catch (error: any) {
      return this.handleReadError(
        userId,
        error,
        'Could not read Gmail message',
      );
    }
  }

  private async getAuthorizedClient(userId: string) {
    const connection = await this.connectionModel
      .findOne({ userId: new Types.ObjectId(userId), status: 'active' })
      .select('+refreshToken')
      .exec();
    if (!connection?.refreshToken) {
      throw new GmailReaderException(
        GmailReaderErrorCode.NOT_CONNECTED,
        'Gmail is not connected',
        HttpStatus.UNAUTHORIZED,
      );
    }
    return {
      gmail: this.clientFactory.createGmailClient(connection.refreshToken),
      connection,
    };
  }

  private createState(userId: string): string {
    const payload = `${userId}.${Date.now()}`;
    const signature = createHmac('sha256', this.getStateSecret())
      .update(payload)
      .digest('hex');
    return Buffer.from(`${payload}.${signature}`).toString('base64url');
  }

  private verifyState(state: string): string {
    const decoded = Buffer.from(state, 'base64url').toString('utf8');
    const [userId, issuedAtText, signature = ''] = decoded.split('.');
    const payload = `${userId}.${issuedAtText}`;
    const expected = createHmac('sha256', this.getStateSecret())
      .update(payload)
      .digest('hex');
    const issuedAt = Number(issuedAtText);
    const validSignature =
      signature.length === expected.length &&
      timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    if (
      !Types.ObjectId.isValid(userId) ||
      !Number.isFinite(issuedAt) ||
      issuedAt > Date.now() ||
      Date.now() - issuedAt > 10 * 60 * 1000 ||
      !validSignature
    ) {
      throw new GmailReaderException(
        GmailReaderErrorCode.REAUTH_REQUIRED,
        'Invalid or expired OAuth state',
        HttpStatus.UNAUTHORIZED,
      );
    }
    return userId;
  }

  private getStateSecret(): string {
    return (
      this.configService.get<string>('GMAIL_READER_STATE_SECRET') ||
      this.configService.get<string>('GOOGLE_CLIENT_SECRET') ||
      'development-gmail-state-secret'
    );
  }

  private async handleReadError(
    userId: string,
    error: any,
    fallbackMessage: string,
  ): Promise<never> {
    if (this.isAuthorizationError(error)) {
      await this.connectionModel
        .updateOne(
          { userId: new Types.ObjectId(userId) },
          { $set: { status: 're_auth_required' } },
        )
        .exec();
      throw new GmailReaderException(
        GmailReaderErrorCode.REAUTH_REQUIRED,
        'Gmail authorization is no longer valid',
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (this.isNotFoundError(error)) {
      throw new GmailReaderException(
        GmailReaderErrorCode.MESSAGE_NOT_FOUND,
        'Gmail message was not found',
        HttpStatus.NOT_FOUND,
      );
    }

    throw new GmailReaderException(
      GmailReaderErrorCode.TEMPORARILY_UNAVAILABLE,
      fallbackMessage,
      HttpStatus.BAD_GATEWAY,
    );
  }

  private isAuthorizationError(error: any): boolean {
    const status = error?.response?.status ?? error?.code;
    const providerCode = error?.response?.data?.error;
    const message = String(error?.message || '').toLowerCase();
    return (
      status === 401 ||
      providerCode === 'invalid_grant' ||
      message.includes('invalid_grant') ||
      message.includes('invalid credentials')
    );
  }

  private isNotFoundError(error: any): boolean {
    return (error?.response?.status ?? error?.code) === 404;
  }
}
