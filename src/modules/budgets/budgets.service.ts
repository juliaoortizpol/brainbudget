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
    const userObjectId = new Types.ObjectId(userId);

    // Soft delete any existing active budgets for this user
    const existingBudgets = await this.budgetModel.find({ userId: userObjectId, isDeleted: false }).select('_id').exec();
    if (existingBudgets.length > 0) {
      const budgetIds = existingBudgets.map(b => b._id);
      await this.budgetModel.updateMany(
        { _id: { $in: budgetIds } },
        { $set: { isDeleted: true, deletedAt: new Date() } }
      ).exec();
      
      await this.budgetItemModel.updateMany(
        { budgetId: { $in: budgetIds }, isDeleted: false },
        { $set: { isDeleted: true, deletedAt: new Date() } }
      ).exec();
    }

    const createdBudget = new this.budgetModel({
      ...budgetData,
      userId: userObjectId,
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
    const userObjectId = new Types.ObjectId(userId);
    const budgetObjectId = new Types.ObjectId(id);

    const existingBudget = await this.budgetModel.findOneAndUpdate(
      { _id: budgetObjectId, userId: userObjectId, isDeleted: false },
      { $set: budgetData },
      { new: true },
    ).exec();

    if (!existingBudget) {
      throw new NotFoundException(`Budget #${id} not found`);
    }

    if (items) {
      for (const item of items) {
        const categoryId = new Types.ObjectId(item.expenseCategoryId);
        const existingItem = await this.budgetItemModel.findOne({
          budgetId: budgetObjectId,
          expenseCategoryId: categoryId,
          isDeleted: false
        }).exec();

        if (existingItem) {
          // Increment the planned amount as requested
          existingItem.plannedAmount += item.plannedAmount;
          if (item.alertEnabled !== undefined) {
            existingItem.alertEnabled = item.alertEnabled;
          }
          await existingItem.save();
        } else {
          // Create a new budget item if it doesn't exist for this category
          const newItem = new this.budgetItemModel({
            ...item,
            budgetId: budgetObjectId,
            userId: userObjectId,
            expenseCategoryId: categoryId,
          });
          await newItem.save();
        }
      }
    }

    return this.findOne(id, userId);
  }

  async softDelete(id: string, userId: string): Promise<any> {
    const userObjectId = new Types.ObjectId(userId);
    const budgetObjectId = new Types.ObjectId(id);

    const deletedBudget = await this.budgetModel.findOneAndUpdate(
      { _id: budgetObjectId, userId: userObjectId, isDeleted: false },
      { $set: { isDeleted: true, deletedAt: new Date() } },
      { new: true },
    ).exec();

    if (!deletedBudget) {
      throw new NotFoundException(`Budget #${id} not found`);
    }

    // Soft delete associated items
    await this.budgetItemModel.updateMany(
      { budgetId: budgetObjectId, isDeleted: false },
      { $set: { isDeleted: true, deletedAt: new Date() } }
    ).exec();

    return deletedBudget;
  }

  async softDeleteBudgetItem(budgetId: string, itemId: string, userId: string): Promise<any> {
    const deletedItem = await this.budgetItemModel.findOneAndUpdate(
      { 
        _id: new Types.ObjectId(itemId), 
        budgetId: new Types.ObjectId(budgetId),
        userId: new Types.ObjectId(userId), 
        isDeleted: false 
      },
      { $set: { isDeleted: true, deletedAt: new Date() } },
      { new: true },
    ).exec();

    if (!deletedItem) {
      throw new NotFoundException(`Budget item #${itemId} not found`);
    }
    return deletedItem;
  }

  async updateBudgetItem(budgetId: string, itemId: string, userId: string, updateDto: any): Promise<any> {
    const updatedItem = await this.budgetItemModel.findOneAndUpdate(
      { 
        _id: new Types.ObjectId(itemId), 
        budgetId: new Types.ObjectId(budgetId),
        userId: new Types.ObjectId(userId), 
        isDeleted: false 
      },
      { $set: updateDto },
      { new: true },
    ).exec();

    if (!updatedItem) {
      throw new NotFoundException(`Budget item #${itemId} not found`);
    }
    return updatedItem;
  }
}
