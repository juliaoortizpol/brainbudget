import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Transaction, TransactionDocument } from './schemas/transaction.schema';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { GetTransactionsFilterDto } from './dto/get-transactions-filter.dto';
import { Budget, BudgetDocument } from '../budgets/schemas/budget.schema';
import {
  BudgetItem,
  BudgetItemDocument,
} from '../budgets/schemas/budget-item.schema';

@Injectable()
export class TransactionsService {
  constructor(
    @InjectModel(Transaction.name)
    private transactionModel: Model<TransactionDocument>,
    @InjectModel(Budget.name) private budgets: Model<BudgetDocument>,
    @InjectModel(BudgetItem.name) private items: Model<BudgetItemDocument>,
  ) {}

  private async validateAssignment(
    userId: string,
    itemId: string,
    type: string,
    date: Date,
  ) {
    const item = await this.items
      .findOne({
        _id: new Types.ObjectId(itemId),
        userId: new Types.ObjectId(userId),
        isDeleted: false,
      })
      .exec();
    const budget =
      item &&
      (await this.budgets
        .findOne({
          _id: item.budgetId,
          userId: new Types.ObjectId(userId),
          isDeleted: false,
        })
        .exec());
    if (!item || !budget) {
      throw new BadRequestException(
        'Budget item is unavailable; choose another item',
      );
    }
    if (budget.status !== 'active') {
      throw new BadRequestException('Budget must be active for assignment');
    }
    if (item.type !== type) {
      throw new BadRequestException(
        'Budget item type must match transaction type',
      );
    }
    const timestamp = new Date(date).getTime();
    if (
      !(
        timestamp >= budget.startDate.getTime() &&
        timestamp <= budget.endDate.getTime()
      )
    ) {
      throw new BadRequestException(
        'Transaction date must be within the budget period',
      );
    }
  }

  private async assignment(
    userId: string,
    dto: UpdateTransactionDto,
    type: string,
    date: Date,
  ) {
    const assigned = typeof dto.budgetItemId === 'string';
    const status = assigned ? 'manual' : 'needs_review';
    if (
      (dto.matchingStatus !== undefined && dto.matchingStatus !== status) ||
      (dto.matchingSource !== undefined &&
        (!assigned || dto.matchingSource !== 'manual')) ||
      dto.matchingConfidence !== undefined
    ) {
      throw new BadRequestException(
        'Matching metadata must agree with assignment',
      );
    }
    if (assigned) {
      await this.validateAssignment(userId, dto.budgetItemId!, type, date);
    }
    return {
      budgetItemId: assigned
        ? new Types.ObjectId(dto.budgetItemId!)
        : undefined,
      matchingStatus: status,
      matchingSource: assigned ? 'manual' : undefined,
    };
  }

  async create(
    userId: string,
    createTransactionDto: CreateTransactionDto,
  ): Promise<Transaction> {
    const assignment = await this.assignment(
      userId,
      createTransactionDto,
      createTransactionDto.type,
      createTransactionDto.date,
    );
    const createdTransaction = new this.transactionModel({
      ...createTransactionDto,
      ...assignment,
      userId: new Types.ObjectId(userId),
      accountId: createTransactionDto.accountId
        ? new Types.ObjectId(createTransactionDto.accountId)
        : undefined,
    });
    return createdTransaction.save();
  }

  async findAll(userId: string, filterDto: GetTransactionsFilterDto) {
    const {
      accountId,
      budgetItemId,
      startDate,
      endDate,
      type,
      page = 1,
      limit = 10,
    } = filterDto;

    const query: {
      userId: Types.ObjectId;
      accountId?: Types.ObjectId;
      budgetItemId?: Types.ObjectId;
      type?: string;
      date?: { $gte?: Date; $lte?: Date };
    } = { userId: new Types.ObjectId(userId) };

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
      this.transactionModel
        .find(query)
        .sort({ date: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.transactionModel.countDocuments(query).exec(),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, userId: string): Promise<Transaction> {
    const transaction = await this.transactionModel
      .findOne({
        _id: new Types.ObjectId(id),
        userId: new Types.ObjectId(userId),
      })
      .exec();

    if (!transaction) {
      throw new NotFoundException(`Transaction #${id} not found`);
    }
    return transaction;
  }

  async update(
    id: string,
    userId: string,
    updateTransactionDto: UpdateTransactionDto,
  ): Promise<Transaction> {
    const updateData: Record<string, unknown> = { ...updateTransactionDto };
    const unset: Record<string, 1> = {};
    const filter: Record<string, unknown> = {
      _id: new Types.ObjectId(id),
      userId: new Types.ObjectId(userId),
    };
    const checksAssignment =
      typeof updateTransactionDto.budgetItemId === 'string' ||
      (updateTransactionDto.budgetItemId === undefined &&
        (updateTransactionDto.date !== undefined ||
          updateTransactionDto.type !== undefined));
    let current: Transaction | undefined;
    if (checksAssignment) {
      current = await this.findOne(id, userId);
      // Validate and write against the same effective transaction values.
      Object.assign(filter, {
        date: current.date,
        type: current.type,
        budgetItemId: current.budgetItemId ?? null,
      });
      if (
        updateTransactionDto.budgetItemId === undefined &&
        current.budgetItemId
      ) {
        await this.validateAssignment(
          userId,
          current.budgetItemId.toString(),
          updateTransactionDto.type ?? current.type,
          updateTransactionDto.date ?? current.date,
        );
      }
    }
    if (updateTransactionDto.budgetItemId !== undefined) {
      const assignment = await this.assignment(
        userId,
        updateTransactionDto,
        updateTransactionDto.type ?? current?.type ?? '',
        updateTransactionDto.date ?? current?.date ?? new Date(NaN),
      );
      Object.assign(updateData, assignment);
      unset.matchingConfidence = 1;
      for (const key of ['budgetItemId', 'matchingSource']) {
        if (updateData[key] === undefined) {
          delete updateData[key];
          unset[key] = 1;
        }
      }
    } else if (
      updateTransactionDto.matchingStatus !== undefined ||
      updateTransactionDto.matchingSource !== undefined ||
      updateTransactionDto.matchingConfidence !== undefined
    ) {
      throw new BadRequestException(
        'Matching metadata requires an assignment request',
      );
    }
    if (updateTransactionDto.accountId) {
      updateData.accountId = new Types.ObjectId(updateTransactionDto.accountId);
    }

    const existingTransaction = await this.transactionModel
      .findOneAndUpdate(
        filter,
        {
          $set: updateData,
          ...(Object.keys(unset).length ? { $unset: unset } : {}),
        },
        { new: true, runValidators: true },
      )
      .exec();

    if (!existingTransaction) {
      if (checksAssignment) {
        throw new BadRequestException(
          'Transaction changed during assignment validation; reload and retry',
        );
      }
      throw new NotFoundException(`Transaction #${id} not found`);
    }

    return existingTransaction;
  }

  async remove(id: string, userId: string): Promise<void> {
    const deletedTransaction = await this.transactionModel
      .findOneAndDelete({
        _id: new Types.ObjectId(id),
        userId: new Types.ObjectId(userId),
      })
      .exec();

    if (!deletedTransaction) {
      throw new NotFoundException(`Transaction #${id} not found`);
    }
  }
}
