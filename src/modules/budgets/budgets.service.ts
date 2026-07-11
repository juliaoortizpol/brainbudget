import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Budget, BudgetDocument } from './schemas/budget.schema';
import { BudgetItem, BudgetItemDocument } from './schemas/budget-item.schema';
import {
  Transaction,
  TransactionDocument,
} from '@/modules/transactions/schemas/transaction.schema';
import { CreateBudgetDto } from './dto/create-budget.dto';
import { UpdateBudgetDto } from './dto/update-budget.dto';

@Injectable()
export class BudgetsService {
  constructor(
    @InjectModel(Budget.name) private budgetModel: Model<BudgetDocument>,
    @InjectModel(BudgetItem.name)
    private budgetItemModel: Model<BudgetItemDocument>,
    @InjectModel(Transaction.name)
    private transactionModel: Model<TransactionDocument>,
  ) {}

  async create(userId: string, createBudgetDto: CreateBudgetDto): Promise<any> {
    const { items, ...budgetData } = createBudgetDto;
    const userObjectId = new Types.ObjectId(userId);

    // Soft delete any existing active budgets for this user
    const existingBudgets = await this.budgetModel
      .find({ userId: userObjectId, isDeleted: false })
      .select('_id')
      .exec();
    if (existingBudgets.length > 0) {
      const budgetIds = existingBudgets.map((b) => b._id);
      await this.budgetModel
        .updateMany(
          { _id: { $in: budgetIds } },
          { $set: { isDeleted: true, deletedAt: new Date() } },
        )
        .exec();

      await this.budgetItemModel
        .updateMany(
          { budgetId: { $in: budgetIds }, isDeleted: false },
          { $set: { isDeleted: true, deletedAt: new Date() } },
        )
        .exec();
    }

    const createdBudget = new this.budgetModel({
      ...budgetData,
      userId: userObjectId,
    });
    const savedBudget = await createdBudget.save();

    if (items && items.length > 0) {
      const budgetItems = items.map((item) => ({
        ...item,
        budgetId: savedBudget._id,
        userId: new Types.ObjectId(userId),
      }));
      await this.budgetItemModel.insertMany(budgetItems);
    }

    return this.findOne(savedBudget._id.toString(), userId);
  }

  async findAll(userId: string): Promise<any[]> {
    const budgets = await this.budgetModel
      .find({ userId: new Types.ObjectId(userId), isDeleted: false })
      .exec();

    if (budgets.length === 0) return [];

    const budgetIds = budgets.map((b) => b._id);
    const allItems = await this.budgetItemModel
      .find({ budgetId: { $in: budgetIds }, isDeleted: false })
      .exec();

    const itemsByBudget = new Map<string, any[]>();
    for (const item of allItems) {
      const bId = item.budgetId.toString();
      if (!itemsByBudget.has(bId)) {
        itemsByBudget.set(bId, []);
      }
      itemsByBudget.get(bId)!.push(item);
    }

    const budgetsWithSpent = await Promise.all(
      budgets.map(async (budget) => {
        const budgetItems = itemsByBudget.get(budget._id.toString()) || [];
        const items = await this.appendSpentToItems(budget, budgetItems);

        return {
          ...budget.toObject(),
          items,
        };
      }),
    );

    return budgetsWithSpent;
  }

  async findOne(id: string, userId: string): Promise<any> {
    const budget = await this.budgetModel
      .findOne({
        _id: new Types.ObjectId(id),
        userId: new Types.ObjectId(userId),
        isDeleted: false,
      })
      .exec();

    if (!budget) {
      throw new NotFoundException(`Budget #${id} not found`);
    }

    const budgetItems = await this.budgetItemModel
      .find({ budgetId: budget._id, isDeleted: false })
      .exec();

    const items = await this.appendSpentToItems(budget, budgetItems);

    return {
      ...budget.toObject(),
      items,
    };
  }

  async update(
    id: string,
    userId: string,
    updateBudgetDto: UpdateBudgetDto,
  ): Promise<any> {
    const { items, ...budgetData } = updateBudgetDto;
    const userObjectId = new Types.ObjectId(userId);
    const budgetObjectId = new Types.ObjectId(id);

    const existingBudget = await this.budgetModel
      .findOneAndUpdate(
        { _id: budgetObjectId, userId: userObjectId, isDeleted: false },
        { $set: budgetData },
        { new: true },
      )
      .exec();

    if (!existingBudget) {
      throw new NotFoundException(`Budget #${id} not found`);
    }

    if (items && items.length > 0) {
      for (const item of items) {
        // Create new budget items
        const newItem = new this.budgetItemModel({
          ...item,
          budgetId: budgetObjectId,
          userId: userObjectId,
        });
        await newItem.save();
      }
    }

    return this.findOne(id, userId);
  }

  async softDelete(id: string, userId: string): Promise<any> {
    const userObjectId = new Types.ObjectId(userId);
    const budgetObjectId = new Types.ObjectId(id);

    const deletedBudget = await this.budgetModel
      .findOneAndUpdate(
        { _id: budgetObjectId, userId: userObjectId, isDeleted: false },
        { $set: { isDeleted: true, deletedAt: new Date() } },
        { new: true },
      )
      .exec();

    if (!deletedBudget) {
      throw new NotFoundException(`Budget #${id} not found`);
    }

    // Soft delete associated items
    await this.budgetItemModel
      .updateMany(
        { budgetId: budgetObjectId, isDeleted: false },
        { $set: { isDeleted: true, deletedAt: new Date() } },
      )
      .exec();

    return deletedBudget;
  }

  async softDeleteBudgetItem(
    budgetId: string,
    itemId: string,
    userId: string,
  ): Promise<any> {
    const deletedItem = await this.budgetItemModel
      .findOneAndUpdate(
        {
          _id: new Types.ObjectId(itemId),
          budgetId: new Types.ObjectId(budgetId),
          userId: new Types.ObjectId(userId),
          isDeleted: false,
        },
        { $set: { isDeleted: true, deletedAt: new Date() } },
        { new: true },
      )
      .exec();

    if (!deletedItem) {
      throw new NotFoundException(`Budget item #${itemId} not found`);
    }
    return deletedItem;
  }

  async addItem(
    budgetId: string,
    userId: string,
    createItemDto: any,
  ): Promise<any> {
    const userObjectId = new Types.ObjectId(userId);
    const budgetObjectId = new Types.ObjectId(budgetId);

    const budget = await this.budgetModel
      .findOne({ _id: budgetObjectId, userId: userObjectId, isDeleted: false })
      .exec();
    if (!budget) {
      throw new NotFoundException(`Budget #${budgetId} not found`);
    }

    const newItem = new this.budgetItemModel({
      ...createItemDto,
      budgetId: budgetObjectId,
      userId: userObjectId,
    });
    return await newItem.save();
  }

  async updateBudgetItem(
    budgetId: string,
    itemId: string,
    userId: string,
    updateDto: any,
  ): Promise<any> {
    const updatedItem = await this.budgetItemModel
      .findOneAndUpdate(
        {
          _id: new Types.ObjectId(itemId),
          budgetId: new Types.ObjectId(budgetId),
          userId: new Types.ObjectId(userId),
          isDeleted: false,
        },
        { $set: updateDto },
        { new: true },
      )
      .exec();

    if (!updatedItem) {
      throw new NotFoundException(`Budget item #${itemId} not found`);
    }
    return updatedItem;
  }
  private async appendSpentToItems(
    budget: any,
    budgetItems: any[],
  ): Promise<any[]> {
    if (!budgetItems.length) return [];

    const now = new Date();
    const endDateLimit = budget.endDate < now ? budget.endDate : now;

    const transactions = await this.transactionModel.aggregate([
      {
        $match: {
          userId: budget.userId,
          budgetItemId: { $in: budgetItems.map((item) => item._id) },
          date: {
            $gte: budget.startDate,
            $lte: endDateLimit,
          },
        },
      },
      {
        $group: {
          _id: '$budgetItemId',
          totalSpent: { $sum: '$amount' },
        },
      },
    ]);

    const spentMap = new Map<string, number>();
    for (const t of transactions) {
      spentMap.set(t._id.toString(), t.totalSpent);
    }

    return budgetItems.map((item) => ({
      ...item.toObject(),
      spent: spentMap.get(item._id.toString()) || 0,
    }));
  }
}
