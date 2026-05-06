import { IsNumber, IsOptional, IsBoolean } from 'class-validator';

export class UpdateBudgetItemDto {
  @IsNumber()
  @IsOptional()
  plannedAmount?: number;

  @IsBoolean()
  @IsOptional()
  alertEnabled?: boolean;
}
