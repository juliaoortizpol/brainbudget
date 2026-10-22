import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsDateString,
  IsOptional,
  ValidateNested,
  IsNumber,
  IsBoolean,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';
import { BudgetItemMatchingRuleDto } from './budget-item-matching-rule.dto';

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

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BudgetItemMatchingRuleDto)
  matchingRules?: BudgetItemMatchingRuleDto[];
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
