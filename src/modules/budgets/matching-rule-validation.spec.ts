import { ValidationPipe } from '@nestjs/common';
import { model, Types } from 'mongoose';
import { BudgetsService } from './budgets.service';
import { CreateBudgetDto, CreateBudgetItemDto } from './dto/create-budget.dto';
import { UpdateBudgetDto } from './dto/update-budget.dto';
import { UpdateBudgetItemDto } from './dto/update-budget-item.dto';
import { matchingRulesError } from './matching-rule-validation';
import { BudgetItemSchema } from './schemas/budget-item.schema';

describe('Replacement matching rule validation', () => {
  const rule = {
    id: 'rule',
    field: 'description' as const,
    operator: 'equals' as const,
    value: ' Monthly, RENT! ',
    source: 'learned' as const,
  };
  const invalid = [
    null,
    {},
    [null],
    [undefined],
    [{ ...rule, id: '  ' }],
    [{ ...rule, id: 'x'.repeat(129) }],
    [{ ...rule, value: '' }],
    [{ ...rule, value: '  ' }],
    [{ ...rule, value: '***' }],
    [{ ...rule, value: 'help.uber.com' }],
    [{ ...rule, value: 'x'.repeat(257) }],
    [rule, { ...rule, value: 'another keyword' }],
    [
      rule,
      { ...rule, id: 'other', value: 'monthly rent', source: 'suggested' },
    ],
    Array.from({ length: 101 }, (_, i) => ({
      ...rule,
      id: String(i),
      value: String(i),
    })),
  ];
  const pipe = new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  const item = { name: 'Rent', type: 'expense', plannedAmount: 100 };
  const budget = {
    name: 'November',
    periodType: 'monthly',
    startDate: '2026-11-01',
    endDate: '2026-11-30',
    status: 'draft',
  };
  const id = new Types.ObjectId().toString();

  it.each(invalid.map((rules, i) => [i, rules] as const))(
    'rejects invalid payload %s across DTO and service entry points before writes',
    async (_, rules) => {
      for (const [metatype, body] of [
        [CreateBudgetItemDto, { ...item, matchingRules: rules }],
        [UpdateBudgetItemDto, { matchingRules: rules }],
        [
          CreateBudgetDto,
          { ...budget, items: [{ ...item, matchingRules: rules }] },
        ],
        [UpdateBudgetDto, { items: [{ ...item, matchingRules: rules }] }],
      ] as const) {
        await expect(
          pipe.transform(body, { type: 'body', metatype }),
        ).rejects.toThrow();
      }
      const mutation = jest.fn(() => {
        throw new Error('Unexpected database access');
      });
      const models = new Proxy({}, { get: () => mutation });
      const service = new BudgetsService(
        models as never,
        models as never,
        models as never,
      );
      const replacement = {
        ...item,
        matchingRules: rules,
      } as CreateBudgetItemDto;
      await expect(
        service.create(id, { ...budget, items: [item, replacement] }),
      ).rejects.toThrow('matchingRules');
      await expect(
        service.update(id, id, { items: [item, replacement] }),
      ).rejects.toThrow('matchingRules');
      await expect(service.addItem(id, id, replacement)).rejects.toThrow(
        'matchingRules',
      );
      await expect(
        service.updateBudgetItem(id, id, id, replacement),
      ).rejects.toThrow('matchingRules');
      expect(mutation).not.toHaveBeenCalled();
    },
  );

  it('allows boundaries and independent field/operator keys', () => {
    expect(
      matchingRulesError([
        { ...rule, id: 'x'.repeat(128), value: 'x'.repeat(256) },
      ]),
    ).toBeUndefined();
    expect(
      matchingRulesError(
        Array.from({ length: 100 }, (_, i) => ({
          ...rule,
          id: String(i),
          value: String(i),
        })),
      ),
    ).toBeUndefined();
    expect(
      matchingRulesError([
        rule,
        { ...rule, id: 'merchant', field: 'merchant' },
        { ...rule, id: 'contains', operator: 'contains' },
      ]),
    ).toBeUndefined();
  });

  it('allows overlaps across items in a budget write', async () => {
    const findOneAndUpdate = jest
      .fn()
      .mockReturnValue({ exec: () => Promise.resolve({}) });
    const save = jest.fn().mockResolvedValue({});
    class ItemModel {
      save = save;
    }
    const service = new BudgetsService(
      { findOneAndUpdate } as never,
      ItemModel as never,
      {} as never,
    );
    jest.spyOn(service, 'findOne').mockResolvedValue({} as never);
    await service.update(id, id, {
      items: [
        { ...item, matchingRules: [rule] },
        { ...item, matchingRules: [rule] },
      ],
    });
    expect(save).toHaveBeenCalledTimes(2);
  });

  const Item = model('RuleValidationItem', BudgetItemSchema);
  it('preserves advanced display values and sources through DTO and schema serialization', async () => {
    const rules = [
      rule,
      {
        ...rule,
        id: 'merchant',
        field: 'merchant',
        operator: 'contains',
        source: 'suggested',
      },
    ];
    const dto = (await pipe.transform(
      { ...item, matchingRules: rules },
      { type: 'body', metatype: CreateBudgetItemDto },
    )) as CreateBudgetItemDto;
    const document = new Item({ ...dto, userId: id, budgetId: id });
    await document.validate();
    expect(document.toObject().matchingRules).toEqual(rules);
  });

  it('rejects schema writes that bypass DTOs', async () => {
    for (const rules of invalid) {
      const document = new Item({
        ...item,
        userId: id,
        budgetId: id,
        matchingRules: rules,
      });
      await expect(document.validate()).rejects.toThrow();
    }
  });

  it('updates unrelated fields without sending legacy rules for validation or rewriting', async () => {
    const legacy = [{ ...rule, value: '***' }];
    const update = jest
      .fn<unknown, [unknown, unknown, unknown]>()
      .mockReturnValue({
        exec: () => Promise.resolve({ ...item, matchingRules: legacy }),
      });
    const service = new BudgetsService(
      {} as never,
      { findOneAndUpdate: update } as never,
      {} as never,
    );
    const result = await service.updateBudgetItem(id, id, id, {
      name: 'Housing',
    });
    expect(result.matchingRules).toEqual(legacy);
    expect(update.mock.calls[0][1]).toEqual({ $set: { name: 'Housing' } });
  });
});
