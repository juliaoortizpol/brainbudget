import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { GmailReaderService } from './gmail-reader.service';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { ListGmailMessagesDto } from './dto/list-gmail-messages.dto';

@Controller('gmail-reader')
export class GmailReaderController {
  constructor(private readonly gmailReader: GmailReaderService) {}

  @UseGuards(JwtAuthGuard)
  @Get('auth-url')
  getAuthorizationUrl(@CurrentUser() user: { userId: string }) {
    return { url: this.gmailReader.getAuthorizationUrl(user.userId) };
  }

  @Get('oauth/callback')
  connectFromCallback(
    @Query('code') code: string,
    @Query('state') state: string,
  ) {
    if (!code || !state) {
      throw new BadRequestException('Missing OAuth code or state');
    }
    return this.gmailReader.connectFromCallback(code, state);
  }

  @UseGuards(JwtAuthGuard)
  @Get('status')
  getStatus(@CurrentUser() user: { userId: string }) {
    return this.gmailReader.getStatus(user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('connection')
  disconnect(@CurrentUser() user: { userId: string }) {
    return this.gmailReader.disconnect(user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('messages')
  listMessages(
    @CurrentUser() user: { userId: string },
    @Query() query: ListGmailMessagesDto,
  ) {
    return this.gmailReader.listMessages(user.userId, query);
  }

  @UseGuards(JwtAuthGuard)
  @Get('messages/:messageId')
  getMessage(
    @CurrentUser() user: { userId: string },
    @Param('messageId') messageId: string,
  ) {
    return this.gmailReader.getMessage(user.userId, messageId);
  }
}
