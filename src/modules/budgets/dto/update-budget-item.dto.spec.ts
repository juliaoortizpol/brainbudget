import { ValidationPipe } from '@nestjs/common';
import { Types } from 'mongoose';
import { BudgetsService } from '../budgets.service';
import { UpdateBudgetItemDto } from './update-budget-item.dto';

describe('Budget item rename', () => {
  const pipe = new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  });

  it('accepts a name-only update and persists the new name within the user and budget scope', async () => {
    const dto = await pipe.transform(
      { name: 'Transportation' },
      {
        type: 'body',
        metatype: UpdateBudgetItemDto,
      },
    );
    const budgetId = new Types.ObjectId();
    const itemId = new Types.ObjectId();
    const userId = new Types.ObjectId();
    const saved = { _id: itemId, name: 'Transportation' };
    const itemModel = {
      findOneAndUpdate: jest
        .fn()
        .mockReturnValue({ exec: jest.fn().mockResolvedValue(saved) }),
    };
    const service = new BudgetsService({} as any, itemModel as any, {} as any);

    await expect(
      service.updateBudgetItem(
        budgetId.toString(),
        itemId.toString(),
        userId.toString(),
        dto,
      ),
    ).resolves.toEqual(saved);
    expect(itemModel.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: itemId, budgetId, userId, isDeleted: false },
      { $set: { name: 'Transportation' } },
      { new: true },
    );
  });

  it.each(['', 123])('rejects an invalid name: %j', async (name) => {
    await expect(
      pipe.transform({ name }, { type: 'body', metatype: UpdateBudgetItemDto }),
    ).rejects.toThrow();
  });

  it('still accepts updates that omit the name', async () => {
    await expect(
      pipe.transform(
        { plannedAmount: 100 },
        { type: 'body', metatype: UpdateBudgetItemDto },
      ),
    ).resolves.toEqual({ plannedAmount: 100 });
  });
});
