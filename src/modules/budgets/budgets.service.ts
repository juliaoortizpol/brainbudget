import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Budget, BudgetDocument } from './schemas/budget.schema';
import { BudgetItem, BudgetItemDocument } from './schemas/budget-item.schema';
import { CreateBudgetDto } from './dto/create-budget.dto';
import { UpdateBudgetDto } from './dto/update-budget.dto';

@Injectable()
export class BudgetsService {
  constructor(
    @InjectModel(Budget.name) private budgetModel: Model<BudgetDocument>,
    @InjectModel(BudgetItem.name) private budgetItemModel: Model<BudgetItemDocument>,
  ) {}

  async create(userId: string, createBudgetDto: CreateBudgetDto): Promise<any> {
    const { items, ...budgetData } = createBudgetDto;

    const createdBudget = new this.budgetModel({
      ...budgetData,
      userId: new Types.ObjectId(userId),
    });
    const savedBudget = await createdBudget.save();

    if (items && items.length > 0) {
      const budgetItems = items.map(item => ({
        ...item,
        budgetId: savedBudget._id,
        userId: new Types.ObjectId(userId),
        expenseCategoryId: new Types.ObjectId(item.expenseCategoryId),
      }));
      await this.budgetItemModel.insertMany(budgetItems);
    }

    return this.findOne(savedBudget._id.toString(), userId);
  }

  async findAll(userId: string): Promise<BudgetDocument[]> {
    return this.budgetModel.find({ userId: new Types.ObjectId(userId), isDeleted: false }).exec();
  }

  async findOne(id: string, userId: string): Promise<any> {
    const budget = await this.budgetModel.findOne({
      _id: new Types.ObjectId(id),
      userId: new Types.ObjectId(userId),
      isDeleted: false,
    }).exec();

    if (!budget) {
      throw new NotFoundException(`Budget #${id} not found`);
    }

    const items = await this.budgetItemModel.find({ budgetId: budget._id, isDeleted: false }).exec();

    return {
      ...budget.toObject(),
      items,
    };
  }

  async update(id: string, userId: string, updateBudgetDto: UpdateBudgetDto): Promise<any> {
    const { items, ...budgetData } = updateBudgetDto;

    const existingBudget = await this.budgetModel.findOneAndUpdate(
      { _id: new Types.ObjectId(id), userId: new Types.ObjectId(userId), isDeleted: false },
      { $set: budgetData },
      { new: true },
    ).exec();

    if (!existingBudget) {
      throw new NotFoundException(`Budget #${id} not found`);
    }

    if (items) {
      // For simplicity, soft-delete existing items and insert new ones
      // In a real scenario, you'd want to match IDs and update/insert/delete as needed.
      await this.budgetItemModel.updateMany(
        { budgetId: existingBudget._id, isDeleted: false },
        { $set: { isDeleted: true, deletedAt: new Date() } }
      ).exec();

      const budgetItems = items.map(item => ({
        ...item,
        budgetId: existingBudget._id,
        userId: new Types.ObjectId(userId),
        expenseCategoryId: new Types.ObjectId(item.expenseCategoryId),
      }));
      await this.budgetItemModel.insertMany(budgetItems);
    }

    return this.findOne(id, userId);
  }

  async softDelete(id: string, userId: string): Promise<any> {
    const deletedBudget = await this.budgetModel.findOneAndUpdate(
      { _id: new Types.ObjectId(id), userId: new Types.ObjectId(userId), isDeleted: false },
      { $set: { isDeleted: true, deletedAt: new Date() } },
      { new: true },
    ).exec();

    if (!deletedBudget) {
      throw new NotFoundException(`Budget #${id} not found`);
    }

    // Soft delete associated items
    await this.budgetItemModel.updateMany(
      { budgetId: deletedBudget._id, isDeleted: false },
      { $set: { isDeleted: true, deletedAt: new Date() } }
    ).exec();

    return deletedBudget;
  }
}
