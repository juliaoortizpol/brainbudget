import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request } from '@nestjs/common';
import { BudgetsService } from './budgets.service';
import { CreateBudgetDto } from './dto/create-budget.dto';
import { UpdateBudgetDto } from './dto/update-budget.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('budgets')
export class BudgetsController {
  constructor(private readonly budgetsService: BudgetsService) { }

  @Post()
  create(@Request() req, @Body() createBudgetDto: CreateBudgetDto) {
    return this.budgetsService.create(req.user.userId, createBudgetDto);
  }

  @Get()
  findAll(@Request() req) {
    return this.budgetsService.findAll(req.user.userId);
  }

  @Get(':id')
  findOne(@Request() req, @Param('id') id: string) {
    return this.budgetsService.findOne(id, req.user.userId);
  }

  @Patch(':id')
  update(@Request() req, @Param('id') id: string, @Body() updateBudgetDto: UpdateBudgetDto) {
    return this.budgetsService.update(id, req.user.userId, updateBudgetDto);
  }

  @Delete(':id')
  remove(@Request() req, @Param('id') id: string) {
    return this.budgetsService.softDelete(id, req.user.userId);
  }

  @Delete(':id/items/:itemId')
  removeItem(@Request() req, @Param('id') id: string, @Param('itemId') itemId: string) {
    return this.budgetsService.softDeleteBudgetItem(id, itemId, req.user.userId);
  }

  @Patch(':id/items/:itemId')
  updateItem(
    @Request() req, 
    @Param('id') id: string, 
    @Param('itemId') itemId: string, 
    @Body() updateDto: any
  ) {
    return this.budgetsService.updateBudgetItem(id, itemId, req.user.userId, updateDto);
  }
}
