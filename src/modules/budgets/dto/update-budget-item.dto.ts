import {
  IsNumber,
  IsOptional,
  IsBoolean,
  IsArray,
  ValidateNested,
  IsString,
  IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';
import { BudgetItemMatchingRuleDto } from './budget-item-matching-rule.dto';

export class UpdateBudgetItemDto {
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  name?: string;

  @IsNumber()
  @IsOptional()
  plannedAmount?: number;

  @IsBoolean()
  @IsOptional()
  alertEnabled?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BudgetItemMatchingRuleDto)
  matchingRules?: BudgetItemMatchingRuleDto[];
}
