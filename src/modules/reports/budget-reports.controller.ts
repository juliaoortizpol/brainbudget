import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Request,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import type { AuthenticatedRequest } from '@/common/types/authenticated-request';
import { BudgetReportsService } from './budget-reports.service';
import { ClosePreviewDto, ConfirmCloseDto } from './close-budget.dto';

@Controller()
@UseGuards(JwtAuthGuard)
export class BudgetReportsController {
  constructor(private readonly reports: BudgetReportsService) {}

  @Post('budgets/:id/close-preview')
  @HttpCode(200)
  preview(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: ClosePreviewDto,
  ) {
    return this.reports.preview(id, req.user.userId, dto);
  }

  @Post('budgets/:id/close')
  @HttpCode(200)
  confirm(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: ConfirmCloseDto,
  ) {
    return this.reports.confirm(id, req.user.userId, dto);
  }

  @Get('budget-reports')
  history(
    @Request() req: AuthenticatedRequest,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    if (
      !Number.isSafeInteger(page) ||
      page < 1 ||
      limit < 1 ||
      limit > 100 ||
      !Number.isSafeInteger((page - 1) * limit)
    )
      throw new BadRequestException(
        'Use a positive page and a limit from 1 to 100',
      );
    return this.reports.history(req.user.userId, page, limit);
  }

  @Get('budget-reports/:id')
  detail(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.reports.detail(req.user.userId, id);
  }

  @Get('budget-reports/:id/transactions/:transactionId')
  transaction(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Param('transactionId') transactionId: string,
  ) {
    return this.reports.transaction(req.user.userId, id, transactionId);
  }
}
