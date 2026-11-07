import {
  IsIn,
  IsNotEmpty,
  IsString,
  MaxLength,
  Matches,
} from 'class-validator';
import { BudgetItemMatchingRule } from '../schemas/budget-item-matching-rule.schema';

export class BudgetItemMatchingRuleDto implements BudgetItemMatchingRule {
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  @Matches(/\S/)
  id!: string;

  @IsIn(['merchant', 'description'])
  field!: 'merchant' | 'description';

  @IsIn(['contains', 'equals'])
  operator!: 'contains' | 'equals';

  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  value!: string;

  @IsIn(['user', 'suggested', 'learned'])
  source!: 'user' | 'suggested' | 'learned';
}
