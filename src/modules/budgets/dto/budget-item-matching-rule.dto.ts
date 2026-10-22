import { IsIn, IsNotEmpty, IsString } from 'class-validator';
import { BudgetItemMatchingRule } from '../schemas/budget-item-matching-rule.schema';

export class BudgetItemMatchingRuleDto implements BudgetItemMatchingRule {
  @IsString()
  @IsNotEmpty()
  id!: string;

  @IsIn(['merchant', 'description'])
  field!: 'merchant' | 'description';

  @IsIn(['contains', 'equals'])
  operator!: 'contains' | 'equals';

  @IsString()
  @IsNotEmpty()
  value!: string;

  @IsIn(['user', 'suggested', 'learned'])
  source!: 'user' | 'suggested' | 'learned';
}
