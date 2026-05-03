import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ExpenseCategory, ExpenseCategoryDocument } from './schemas/expense-category.schema';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectModel(ExpenseCategory.name) private categoryModel: Model<ExpenseCategoryDocument>,
  ) {}

  async create(userId: string, createCategoryDto: CreateCategoryDto): Promise<ExpenseCategoryDocument> {
    const createdCategory = new this.categoryModel({
      ...createCategoryDto,
      userId: new Types.ObjectId(userId),
    });
    return createdCategory.save();
  }

  async findAll(userId: string): Promise<ExpenseCategoryDocument[]> {
    return this.categoryModel.find({ userId: new Types.ObjectId(userId), isDeleted: false }).exec();
  }

  async findOne(id: string, userId: string): Promise<ExpenseCategoryDocument> {
    const category = await this.categoryModel.findOne({
      _id: new Types.ObjectId(id),
      userId: new Types.ObjectId(userId),
      isDeleted: false,
    }).exec();

    if (!category) {
      throw new NotFoundException(`Category #${id} not found`);
    }
    return category;
  }

  async update(id: string, userId: string, updateCategoryDto: UpdateCategoryDto): Promise<ExpenseCategoryDocument> {
    const existingCategory = await this.categoryModel.findOneAndUpdate(
      { _id: new Types.ObjectId(id), userId: new Types.ObjectId(userId), isDeleted: false },
      { $set: updateCategoryDto },
      { new: true },
    ).exec();

    if (!existingCategory) {
      throw new NotFoundException(`Category #${id} not found`);
    }
    return existingCategory;
  }

  async softDelete(id: string, userId: string): Promise<ExpenseCategoryDocument> {
    const deletedCategory = await this.categoryModel.findOneAndUpdate(
      { _id: new Types.ObjectId(id), userId: new Types.ObjectId(userId), isDeleted: false },
      { $set: { isDeleted: true, deletedAt: new Date() } },
      { new: true },
    ).exec();

    if (!deletedCategory) {
      throw new NotFoundException(`Category #${id} not found`);
    }
    return deletedCategory;
  }
}
