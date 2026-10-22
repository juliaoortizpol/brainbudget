import { ValidationPipe } from '@nestjs/common';
import { Types, model } from 'mongoose';
import { BudgetsService } from './budgets.service';
import { CreateBudgetItemDto } from './dto/create-budget.dto';
import { UpdateBudgetItemDto } from './dto/update-budget-item.dto';
import {
  BudgetItemSchema,
  type BudgetItem,
} from './schemas/budget-item.schema';

describe('Budget item keyword persistence', () => {
  const userId = new Types.ObjectId().toString();
  const budgetId = new Types.ObjectId().toString();
  const itemId = new Types.ObjectId().toString();
  const rules = ['Uber', 'DiDi', 'inDrive'].map((value, i) => ({
    id: String(i),
    field: 'merchant' as const,
    operator: 'contains' as const,
    value,
    source: 'user' as const,
  }));
  const pipe = new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  const Item = model('KeywordPersistenceBudgetItem', BudgetItemSchema);

  it('validates, stores, and serializes keywords on item creation', async () => {
    const dto = (await pipe.transform(
      {
        name: 'Transportation',
        type: 'expense',
        plannedAmount: 250,
        matchingRules: rules,
      },
      { type: 'body', metatype: CreateBudgetItemDto },
    )) as CreateBudgetItemDto;
    const save = jest.fn().mockImplementation(function (
      this: InstanceType<typeof Item>,
    ) {
      return Promise.resolve(this.toObject<BudgetItem>());
    });
    class ItemModel extends Item {
      save = save;
    }
    const service = new BudgetsService(
      {
        findOne: () => ({ exec: () => Promise.resolve({ _id: budgetId }) }),
      } as unknown as ConstructorParameters<typeof BudgetsService>[0],
      ItemModel as unknown as ConstructorParameters<typeof BudgetsService>[1],
      {} as ConstructorParameters<typeof BudgetsService>[2],
    );
    const saved = await service.addItem(budgetId, userId, dto);
    expect(saved.matchingRules).toEqual(rules);
    expect(saved.plannedAmount).toBe(250);
    expect(saved.userId.toString()).toBe(userId);
    expect(saved.budgetId.toString()).toBe(budgetId);
  });

  it('updates and reloads keywords, preserves unrelated fields, and can clear rules', async () => {
    const stored = new Item({
      _id: itemId,
      budgetId,
      userId,
      name: 'Transportation',
      type: 'expense',
      plannedAmount: 250,
      icon: 'car',
      alertEnabled: true,
    });
    const findOneAndUpdate = jest
      .fn()
      .mockImplementation(
        (_filter: unknown, update: { $set: Record<string, unknown> }) => ({
          exec: async () => {
            stored.set(update.$set);
            await stored.validate();
            return stored;
          },
        }),
      );
    const budget = {
      _id: new Types.ObjectId(budgetId),
      userId: new Types.ObjectId(userId),
      startDate: new Date(),
      endDate: new Date(),
      toObject: () => ({ _id: budgetId }),
    };
    const aggregate = jest.fn().mockResolvedValue([]);
    const service = new BudgetsService(
      {
        findOne: () => ({ exec: () => Promise.resolve(budget) }),
      } as unknown as ConstructorParameters<typeof BudgetsService>[0],
      {
        findOneAndUpdate,
        find: () => ({ exec: () => Promise.resolve([stored]) }),
      } as unknown as ConstructorParameters<typeof BudgetsService>[1],
      { aggregate } as unknown as ConstructorParameters<
        typeof BudgetsService
      >[2],
    );
    const dto = (await pipe.transform(
      { matchingRules: rules, name: 'Commute' },
      { type: 'body', metatype: UpdateBudgetItemDto },
    )) as UpdateBudgetItemDto;
    await service.updateBudgetItem(budgetId, itemId, userId, dto);
    expect(findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: new Types.ObjectId(itemId),
        budgetId: new Types.ObjectId(budgetId),
        userId: new Types.ObjectId(userId),
        isDeleted: false,
      }),
      { $set: { name: 'Commute', matchingRules: rules } },
      { new: true, runValidators: true },
    );
    const reloaded = await service.findOne(budgetId, userId);
    expect(reloaded.items[0]).toEqual(
      expect.objectContaining({
        name: 'Commute',
        plannedAmount: 250,
        icon: 'car',
        alertEnabled: true,
        matchingRules: rules,
      }),
    );
    await service.updateBudgetItem(budgetId, itemId, userId, {
      matchingRules: [],
    });
    expect(
      (await service.findOne(budgetId, userId)).items[0].matchingRules,
    ).toEqual([]);
  });

  it('preserves keywords when copying items into a new budget', async () => {
    const insertMany = jest.fn().mockResolvedValue([]);
    const nextBudgetId = new Types.ObjectId();
    class BudgetModel {
      static find = () => ({
        select: () => ({ exec: () => Promise.resolve([]) }),
      });
      _id = nextBudgetId;
      save = () => Promise.resolve(this);
    }
    const service = new BudgetsService(
      BudgetModel as unknown as ConstructorParameters<typeof BudgetsService>[0],
      { insertMany } as unknown as ConstructorParameters<
        typeof BudgetsService
      >[1],
      {} as ConstructorParameters<typeof BudgetsService>[2],
    );
    jest.spyOn(service, 'findOne').mockResolvedValue({
      _id: nextBudgetId,
      userId: new Types.ObjectId(userId),
      name: 'Next month',
      periodType: 'monthly',
      startDate: new Date('2026-11-01'),
      endDate: new Date('2026-11-30'),
      status: 'draft',
      items: [],
    });
    await service.create(userId, {
      name: 'Next month',
      periodType: 'monthly',
      startDate: '2026-11-01',
      endDate: '2026-11-30',
      status: 'draft',
      items: [
        {
          name: 'Commute',
          type: 'expense',
          plannedAmount: 250,
          matchingRules: rules,
        },
      ],
    });
    expect(insertMany).toHaveBeenCalledWith([
      expect.objectContaining({ budgetId: nextBudgetId, matchingRules: rules }),
    ]);
  });
});
