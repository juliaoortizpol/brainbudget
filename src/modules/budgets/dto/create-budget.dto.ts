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
  Matches,
  ValidateIf,
} from 'class-validator';
import { ValidMatchingRules } from './valid-matching-rules';
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

  @ValidateIf((_, value) => value !== undefined)
  @ValidMatchingRules()
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

  @IsDateString({ strict: true })
  @IsNotEmpty()
  startDate!: string;

  @IsDateString({ strict: true })
  @ValidateIf((_, value) => value !== undefined)
  endDate?: string;

  @ValidateIf((_, value) => value !== undefined)
  @IsDateString({ strict: true })
  plannedEndDate?: string;

  @ValidateIf((_, value) => value !== undefined)
  @IsDateString({ strict: true })
  actualCutoffDate?: string;

  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  closeThroughDate?: string;

  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  timezone?: string;

  @IsEnum(['draft', 'active', 'closed'])
  @IsNotEmpty()
  status!: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateBudgetItemDto)
  items?: CreateBudgetItemDto[];
}
