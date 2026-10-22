import type { AuthenticatedRequest } from '@/common/types/authenticated-request';
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
} from '@nestjs/common';
import { BudgetsService } from './budgets.service';
import { CreateBudgetDto, CreateBudgetItemDto } from './dto/create-budget.dto';
import { UpdateBudgetDto } from './dto/update-budget.dto';
import { UpdateBudgetItemDto } from './dto/update-budget-item.dto';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('budgets')
export class BudgetsController {
  constructor(private readonly budgetsService: BudgetsService) {}

  @Post()
  create(
    @Request() req: AuthenticatedRequest,
    @Body() createBudgetDto: CreateBudgetDto,
  ) {
    return this.budgetsService.create(req.user.userId, createBudgetDto);
  }

  @Get()
  findAll(@Request() req: AuthenticatedRequest) {
    return this.budgetsService.findAll(req.user.userId);
  }

  @Get(':id')
  findOne(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.budgetsService.findOne(id, req.user.userId);
  }

  @Patch(':id')
  update(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() updateBudgetDto: UpdateBudgetDto,
  ) {
    return this.budgetsService.update(id, req.user.userId, updateBudgetDto);
  }

  @Delete(':id')
  remove(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.budgetsService.softDelete(id, req.user.userId);
  }

  @Post(':id/items')
  addItem(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() createItemDto: CreateBudgetItemDto,
  ) {
    return this.budgetsService.addItem(id, req.user.userId, createItemDto);
  }

  @Delete(':id/items/:itemId')
  removeItem(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
  ) {
    return this.budgetsService.softDeleteBudgetItem(
      id,
      itemId,
      req.user.userId,
    );
  }

  @Patch(':id/items/:itemId')
  updateItem(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() updateDto: UpdateBudgetItemDto,
  ) {
    return this.budgetsService.updateBudgetItem(
      id,
      itemId,
      req.user.userId,
      updateDto,
    );
  }
}
