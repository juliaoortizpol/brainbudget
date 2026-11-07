import {
  IsNumber,
  IsOptional,
  IsBoolean,
  IsArray,
  ValidateNested,
  IsString,
  IsNotEmpty,
  ValidateIf,
} from 'class-validator';
import { ValidMatchingRules } from './valid-matching-rules';
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

  @ValidateIf((_, value) => value !== undefined)
  @ValidMatchingRules()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BudgetItemMatchingRuleDto)
  matchingRules?: BudgetItemMatchingRuleDto[];
}
