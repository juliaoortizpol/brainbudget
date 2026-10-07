import {
  IsNumber,
  IsOptional,
  IsBoolean,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { BudgetItemMatchingRuleDto } from './budget-item-matching-rule.dto';

export class UpdateBudgetItemDto {
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
