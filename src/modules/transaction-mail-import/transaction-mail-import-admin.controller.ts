import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { AdminGuard } from '@/common/guards/admin.guard';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { TransactionMailImportOptionsDto } from './dto/transaction-mail-import-options.dto';
import { TransactionMailImportPreviewService } from './transaction-mail-import-preview.service';

@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin/transaction-mail-import')
export class TransactionMailImportAdminController {
  constructor(
    private readonly previewService: TransactionMailImportPreviewService,
  ) {}

  @Post('preview')
  preview(
    @CurrentUser() user: { userId: string },
    @Body() options: TransactionMailImportOptionsDto,
  ) {
    return this.previewService.preview(user.userId, options);
  }
}
