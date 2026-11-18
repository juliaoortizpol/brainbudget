import { ReportPageDto } from './report-page.dto';
import { ClosedPeriodHistoryService } from './closed-period-history.service';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import type { AuthenticatedRequest } from '@/common/types/authenticated-request';
import { BudgetReportsService } from './budget-reports.service';
import { ClosePreviewDto, ConfirmCloseDto } from './close-budget.dto';

@Controller()
@UseGuards(JwtAuthGuard)
export class BudgetReportsController {
  constructor(
    private readonly reports: BudgetReportsService,
    private readonly closedHistory: ClosedPeriodHistoryService,
  ) {}

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
    @Query() { page, limit }: ReportPageDto,
  ) {
    return this.reports.history(req.user.userId, page, limit);
  }

  @Get('budget-reports/:id')
  detail(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.reports.detail(req.user.userId, id);
  }

  @Get('budget-reports/:id/exceptions')
  exceptions(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Query() { page, limit }: ReportPageDto,
  ) {
    return this.closedHistory.listForReport(req.user.userId, id, page, limit);
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
