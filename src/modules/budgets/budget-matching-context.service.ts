import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Budget, BudgetDocument } from './schemas/budget.schema';
import { BudgetItem, BudgetItemDocument } from './schemas/budget-item.schema';

export interface BudgetMatchingContext {
  userId: Types.ObjectId;
  budgets: BudgetDocument[];
  items: BudgetItemDocument[];
}

@Injectable()
export class BudgetMatchingContextService {
  constructor(
    @InjectModel(Budget.name) private readonly budgets: Model<BudgetDocument>,
    @InjectModel(BudgetItem.name)
    private readonly items: Model<BudgetItemDocument>,
  ) {}

  async load(userId: string): Promise<BudgetMatchingContext> {
    const owner = new Types.ObjectId(userId);
    const budgets = await this.budgets
      .find({
        userId: owner,
        status: 'active',
        isDeleted: false,
      })
      .exec();
    const items = budgets.length
      ? await this.items
          .find({
            userId: owner,
            budgetId: { $in: budgets.map((budget) => budget._id) },
            isDeleted: false,
          })
          .exec()
      : [];
    return { userId: owner, budgets, items };
  }
}
