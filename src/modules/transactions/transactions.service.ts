import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Transaction, TransactionDocument } from './schemas/transaction.schema';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { GetTransactionsFilterDto } from './dto/get-transactions-filter.dto';

@Injectable()
export class TransactionsService {
  constructor(
    @InjectModel(Transaction.name) private transactionModel: Model<TransactionDocument>,
  ) {}

  async create(userId: string, createTransactionDto: CreateTransactionDto): Promise<Transaction> {
    const createdTransaction = new this.transactionModel({
      ...createTransactionDto,
      userId: new Types.ObjectId(userId),
      accountId: new Types.ObjectId(createTransactionDto.accountId),
      budgetItemId: createTransactionDto.budgetItemId ? new Types.ObjectId(createTransactionDto.budgetItemId) : undefined,
    });
    return createdTransaction.save();
  }

  async findAll(userId: string, filterDto: GetTransactionsFilterDto) {
    const { accountId, budgetItemId, startDate, endDate, type, page = 1, limit = 10 } = filterDto;

    const query: Record<string, any> = { userId: new Types.ObjectId(userId) };

    if (accountId) {
      query.accountId = new Types.ObjectId(accountId);
    }
    if (budgetItemId) {
      query.budgetItemId = new Types.ObjectId(budgetItemId);
    }
    if (type) {
      query.type = type;
    }
    if (startDate || endDate) {
      query.date = {};
      if (startDate) {
        query.date.$gte = new Date(startDate);
      }
      if (endDate) {
        query.date.$lte = new Date(endDate);
      }
    }

    const skip = (page - 1) * limit;
    
    const [data, total] = await Promise.all([
      this.transactionModel.find(query).sort({ date: -1 }).skip(skip).limit(limit).exec(),
      this.transactionModel.countDocuments(query).exec()
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      }
    };
  }

  async findOne(id: string, userId: string): Promise<Transaction> {
    const transaction = await this.transactionModel.findOne({ 
      _id: new Types.ObjectId(id), 
      userId: new Types.ObjectId(userId) 
    }).exec();

    if (!transaction) {
      throw new NotFoundException(`Transaction #${id} not found`);
    }
    return transaction;
  }

  async update(id: string, userId: string, updateTransactionDto: UpdateTransactionDto): Promise<Transaction> {
    const existingTransaction = await this.transactionModel.findOneAndUpdate(
      { _id: new Types.ObjectId(id), userId: new Types.ObjectId(userId) },
      { $set: updateTransactionDto },
      { new: true, runValidators: true }
    ).exec();

    if (!existingTransaction) {
      throw new NotFoundException(`Transaction #${id} not found`);
    }

    return existingTransaction;
  }

  async remove(id: string, userId: string): Promise<void> {
    const deletedTransaction = await this.transactionModel.findOneAndDelete({ 
      _id: new Types.ObjectId(id), 
      userId: new Types.ObjectId(userId) 
    }).exec();

    if (!deletedTransaction) {
      throw new NotFoundException(`Transaction #${id} not found`);
    }
  }
}
