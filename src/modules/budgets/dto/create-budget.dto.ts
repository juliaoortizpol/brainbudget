import { IsString, IsNotEmpty, IsEnum, IsDateString, IsOptional, ValidateNested, IsNumber, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateBudgetItemDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(['expense', 'income'])
  @IsNotEmpty()
  type!: string;

  @IsString()
  @IsOptional()
  icon?: string;

  @IsString()
  @IsOptional()
  color?: string;

  @IsNumber()
  @IsNotEmpty()
  plannedAmount!: number;

  @IsBoolean()
  @IsOptional()
  alertEnabled?: boolean;
}

export class CreateBudgetDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsEnum(['monthly', 'weekly', 'custom'])
  @IsNotEmpty()
  periodType!: string;

  @IsDateString()
  @IsNotEmpty()
  startDate!: string;

  @IsDateString()
  @IsNotEmpty()
  endDate!: string;

  @IsEnum(['draft', 'active', 'closed'])
  @IsNotEmpty()
  status!: string;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreateBudgetItemDto)
  items?: CreateBudgetItemDto[];
}
