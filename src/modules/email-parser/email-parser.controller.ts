import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { EmailParserService } from './services/email-parser.service';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';

@Controller('email-parser')
export class EmailParserController {
  constructor(private readonly emailParserService: EmailParserService) {}

  @UseGuards(JwtAuthGuard)
  @Post('seed')
  async seed() {
    return this.emailParserService.seedTestConfig();
  }

  @UseGuards(JwtAuthGuard)
  @Post('test-parse')
  async testParse(
    @Body() body: { senderEmail: string; subject: string; emailBody: string },
  ) {
    const result = await this.emailParserService.parseEmail(
      body.senderEmail,
      body.subject,
      body.emailBody,
    );

    return {
      success: !!result,
      data:
        result ||
        'Could not parse email. Check logs or verify a parsing rule exists.',
    };
  }
}
