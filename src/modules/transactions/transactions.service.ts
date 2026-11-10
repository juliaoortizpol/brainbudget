import {
  BadRequestException,
  Injectable,
  NotFoundException,
  HttpException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { QueryFilter, Model, Types, ClientSession } from 'mongoose';
import { randomUUID } from 'crypto';
import { MerchantNormalizationService } from './merchant-normalization.service';
import { matchingRulesError } from '../budgets/matching-rule-validation';
import {
  budgetCoverage,
  budgetCoversPurchase,
  coverageDateFilter,
} from '../budgets/budget-coverage';
import { coverageWrite } from '../budgets/coverage-write';
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
    session?: ClientSession,
  ) {
    const item = await this.items
      .findOne(
        {
          _id: new Types.ObjectId(itemId),
          userId: new Types.ObjectId(userId),
          isDeleted: false,
        },
        null,
        session ? { session } : {},
      )
      .exec();
    const budget =
      item &&
      (await this.budgets
        .findOne(
          {
            _id: item.budgetId,
            userId: new Types.ObjectId(userId),
            isDeleted: false,
          },
          null,
          session ? { session } : {},
        )
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
    if (!budgetCoversPurchase(budget, new Date(date))) {
      throw new BadRequestException(
        'Transaction date must be within the budget period',
      );
    }
    return item;
  }

  private async assignment(
    userId: string,
    dto: UpdateTransactionDto,
    type: string,
    date: Date,
    session?: ClientSession,
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
      await this.validateAssignment(
        userId,
        dto.budgetItemId!,
        type,
        date,
        session,
      );
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
    return coverageWrite(this.transactionModel.db, userId, (session) =>
      this.createInSession(userId, createTransactionDto, session),
    );
  }

  private async createInSession(
    userId: string,
    createTransactionDto: CreateTransactionDto,
    session: ClientSession,
  ): Promise<Transaction> {
    const assignment = await this.assignment(
      userId,
      createTransactionDto,
      createTransactionDto.type,
      createTransactionDto.date,
      session,
    );
    const createdTransaction = new this.transactionModel({
      ...createTransactionDto,
      ...assignment,
      userId: new Types.ObjectId(userId),
      accountId: createTransactionDto.accountId
        ? new Types.ObjectId(createTransactionDto.accountId)
        : undefined,
    });
    return createdTransaction.save({ session });
  }

  async findAll(userId: string, filterDto: GetTransactionsFilterDto) {
    const {
      accountId,
      budgetItemId,
      budgetId,
      startDate,
      endDate,
      type,
      matchingStatus,
      page = 1,
      limit = 10,
    } = filterDto;

    const query: QueryFilter<Transaction> = {
      userId: new Types.ObjectId(userId),
    };

    if (accountId) {
      query.accountId = new Types.ObjectId(accountId);
    }
    if (budgetItemId) {
      query.budgetItemId = new Types.ObjectId(budgetItemId);
    }
    if (type) {
      query.type = type;
    }
    if (budgetId) {
      if (startDate || endDate)
        throw new BadRequestException(
          'Use budgetId coverage or explicit date filters, not both',
        );
      const budget = await this.budgets
        .findOne({
          _id: new Types.ObjectId(budgetId),
          userId: new Types.ObjectId(userId),
          isDeleted: false,
        })
        .exec();
      if (!budget) throw new NotFoundException('Budget is unavailable');
      query.date = coverageDateFilter(budgetCoverage(budget));
    }
    if (matchingStatus === 'needs_review') {
      // Query stored values before hydration can apply the schema default.
      // Mongo equality to null includes missing fields as well as explicit null.
      query.$and = [
        { type: 'expense' },
        {
          $or: [
            { matchingStatus: 'needs_review' },
            { matchingStatus: null, budgetItemId: null },
          ],
        },
      ];
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
    return coverageWrite(this.transactionModel.db, userId, (session) =>
      updateTransactionDto.rememberMerchant === true
        ? this.rememberAssignment(id, userId, updateTransactionDto, session)
        : this.updateExisting(id, userId, updateTransactionDto, session),
    );
  }

  private async rememberAssignment(
    id: string,
    userId: string,
    dto: UpdateTransactionDto,
    session: ClientSession,
  ): Promise<Transaction> {
    if (
      typeof dto.budgetItemId !== 'string' ||
      !Types.ObjectId.isValid(dto.budgetItemId)
    ) {
      throw new BadRequestException(
        'Remember requires an explicit budget item assignment',
      );
    }
    const rule = {
      id: randomUUID(),
      field: 'merchant' as const,
      operator: 'contains' as const,
      value: dto.merchantKeyword!,
      source: 'learned' as const,
    };
    const error = matchingRulesError([rule]);
    if (error) throw new BadRequestException(error);
    try {
      const activeSession = session;
      const result = await (async () => {
        const current = await this.transactionModel
          .findOne(
            {
              _id: new Types.ObjectId(id),
              userId: new Types.ObjectId(userId),
            },
            null,
            { session: activeSession },
          )
          .exec();
        if (!current) throw new NotFoundException('Transaction is unavailable');
        if (
          current.type !== 'expense' ||
          (dto.type ?? current.type) !== 'expense'
        ) {
          throw new BadRequestException(
            'Remember is available only for expenses',
          );
        }
        const item = await this.validateAssignment(
          userId,
          dto.budgetItemId!,
          'expense',
          dto.date ?? current.date,
          activeSession,
        );
        const normalization = new MerchantNormalizationService();
        const equivalent = item.matchingRules.find(
          (candidate) =>
            candidate.field === 'merchant' &&
            candidate.operator === 'contains' &&
            normalization.normalize(candidate.value) ===
              normalization.normalize(rule.value),
        );
        if (!equivalent || equivalent.source === 'suggested') {
          const rules = item.matchingRules.map((candidate) => ({
            id: candidate.id,
            field: candidate.field,
            operator: candidate.operator,
            value: candidate.value,
            source: candidate === equivalent ? 'learned' : candidate.source,
          }));
          if (!equivalent) rules.push(rule);
          const rulesError = matchingRulesError(rules);
          if (rulesError) throw new BadRequestException(rulesError);
          // A write to the same item serializes concurrent learning attempts.
          // Mongo retries write conflicts with a fresh snapshot via withTransaction.
          const written = await this.items
            .updateOne(
              {
                _id: item._id,
                userId: new Types.ObjectId(userId),
                isDeleted: false,
              },
              equivalent
                ? { $set: { 'matchingRules.$[rule].source': 'learned' } }
                : { $push: { matchingRules: rule } },
              {
                session: activeSession,
                runValidators: true,
                ...(equivalent
                  ? { arrayFilters: [{ 'rule.id': equivalent.id }] }
                  : {}),
              },
            )
            .exec();
          if (written.matchedCount !== 1) {
            throw new BadRequestException(
              'Budget item changed; reload and retry',
            );
          }
        }
        return this.updateExisting(id, userId, dto, activeSession);
      })();
      if (!result)
        throw new ServiceUnavailableException(
          'Remember was not committed; retry',
        );
      return result;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new ServiceUnavailableException(
        'Could not save assignment and merchant rule together; transactional database required. Retry or assign without remember',
      );
    }
  }

  private async updateExisting(
    id: string,
    userId: string,
    updateTransactionDto: UpdateTransactionDto,
    session?: ClientSession,
  ): Promise<Transaction> {
    const { rememberMerchant, merchantKeyword, ...transactionFields } =
      updateTransactionDto;
    void rememberMerchant;
    void merchantKeyword;
    const updateData: Record<string, unknown> = { ...transactionFields };
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
      current = session
        ? ((await this.transactionModel
            .findOne(filter, null, { session })
            .exec()) ?? undefined)
        : await this.findOne(id, userId);
      if (!current) throw new NotFoundException('Transaction is unavailable');
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
          session,
        );
      }
    }
    if (updateTransactionDto.budgetItemId !== undefined) {
      const assignment = await this.assignment(
        userId,
        updateTransactionDto,
        updateTransactionDto.type ?? current?.type ?? '',
        updateTransactionDto.date ?? current?.date ?? new Date(NaN),
        session,
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
        { new: true, runValidators: true, ...(session ? { session } : {}) },
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
