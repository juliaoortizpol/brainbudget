import { ValidationPipe } from '@nestjs/common';
import { model } from 'mongoose';
import { CreateBudgetItemDto } from './create-budget.dto';
import { UpdateBudgetItemDto } from './update-budget-item.dto';
import { BudgetItemSchema } from '../schemas/budget-item.schema';

describe('Budget item matching rules', () => {
  const rule = {
    id: 'rule-1',
    field: 'merchant',
    operator: 'contains',
    value: 'Market',
    source: 'user',
  };
  const pipe = new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  });

  it('accepts rules when creating and clears rules when updating', async () => {
    const result = (await pipe.transform(
      {
        name: 'Food',
        type: 'expense',
        plannedAmount: 100,
        matchingRules: [rule],
      },
      { type: 'body', metatype: CreateBudgetItemDto },
    )) as CreateBudgetItemDto;
    expect(result.matchingRules).toEqual([rule]);
    await expect(
      pipe.transform(
        { matchingRules: [] },
        { type: 'body', metatype: UpdateBudgetItemDto },
      ),
    ).resolves.toEqual({ matchingRules: [] });
  });

  it.each([
    { field: 'amount' },
    { operator: 'regex' },
    { source: 'external' },
    { id: '' },
    { value: 123 },
  ])('rejects an invalid nested rule: %j', async (invalid) => {
    await expect(
      pipe.transform(
        { matchingRules: [{ ...rule, ...invalid }] },
        { type: 'body', metatype: UpdateBudgetItemDto },
      ),
    ).rejects.toThrow();
  });

  it('stores the supplied rule ID without generating a nested MongoDB ID', () => {
    const BudgetItemModel = model(
      'MatchingRulesTestBudgetItem',
      BudgetItemSchema,
    );
    expect(new BudgetItemModel().matchingRules).toEqual([]);
    const item = new BudgetItemModel({ matchingRules: [rule] });
    expect(item.toObject().matchingRules).toEqual([rule]);
  });
});
