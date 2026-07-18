import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { TransactionMailImportOptionsDto } from './dto/transaction-mail-import-options.dto';
import { TransactionMailImportSyncService } from './transaction-mail-import-sync.service';

@UseGuards(JwtAuthGuard)
@Controller('transaction-mail-import')
export class TransactionMailImportController {
  constructor(private readonly syncService: TransactionMailImportSyncService) {}

  @Post('sync')
  sync(
    @CurrentUser() user: { userId: string },
    @Body() options: TransactionMailImportOptionsDto,
  ) {
    return this.syncService.sync(user.userId, options);
  }
}
