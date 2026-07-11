import {
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
  Req,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { IntegrationsService } from './integrations.service';
import { SyncEngineService } from './sync-engine.service';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';

@Controller('integrations')
export class IntegrationsController {
  constructor(
    private readonly integrationsService: IntegrationsService,
    private readonly syncEngineService: SyncEngineService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get('gmail/auth')
  getAuthUrl(@Req() req: any) {
    const url = this.integrationsService.getGmailAuthUrl(req.user.userId);
    return { url };
  }

  // Google hits this endpoint after the user consents
  @Get('gmail/callback')
  async handleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    // state contains the userId we passed in getAuthUrl
    if (!code || !state) {
      return res.redirect(
        `${process.env.FRONTEND_URL || 'http://localhost:5173'}/settings?error=missing_params`,
      );
    }

    try {
      await this.integrationsService.handleGmailCallback(code, state);
      // Redirect back to frontend settings page on success
      return res.redirect(
        `${process.env.FRONTEND_URL || 'http://localhost:5173'}/settings?gmail_connected=true`,
      );
    } catch (error) {
      return res.redirect(
        `${process.env.FRONTEND_URL || 'http://localhost:5173'}/settings?error=gmail_connection_failed`,
      );
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('gmail/status')
  async getStatus(@Req() req: any) {
    const connection = await this.integrationsService.getGmailConnection(
      req.user.userId,
    );
    if (!connection) {
      return { connected: false };
    }
    return {
      connected: connection.status === 'active',
      email: connection.email,
      lastSyncedAt: connection.lastSyncedAt,
      status: connection.status,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('gmail/disconnect')
  async disconnect(@Req() req: any) {
    return this.integrationsService.disconnectGmail(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('gmail/test-fetch')
  async testFetchMails(@Req() req: any, @Query('query') query?: string) {
    // Allows the user to pass a query like ?query=from:alerts@chase.com
    return this.integrationsService.fetchRecentMails(req.user.userId, query);
  }

  @UseGuards(JwtAuthGuard)
  @Post('gmail/sync')
  async syncGmails(@Req() req: any) {
    return await this.syncEngineService.syncEmailsForUser(req.user.userId);
  }
}
