import { PickType, PartialType } from '@nestjs/mapped-types';
import { CreateBudgetDto } from './create-budget.dto';

export class CopyBudgetDraftDto extends PickType(CreateBudgetDto, [
  'name',
  'periodType',
  'startDate',
  'timezone',
  'currency',
  'endDate',
  'plannedEndDate',
] as const) {}

export class ActivateBudgetDto extends PartialType(
  PickType(CreateBudgetDto, ['startDate'] as const),
  { skipNullProperties: false },
) {}
