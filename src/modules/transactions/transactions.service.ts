import { ClosedPeriodHistoryService } from '../reports/closed-period-history.service';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
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
import {
  currencyIssue,
  supportedBudgetCurrency,
} from '../budgets/currency-policy';
import { Transaction, TransactionDocument } from './schemas/transaction.schema';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { GetTransactionsFilterDto } from './dto/get-transactions-filter.dto';
import { Budget, BudgetDocument } from '../budgets/schemas/budget.schema';
import {
  BudgetItem,
  BudgetItemDocument,
} from '../budgets/schemas/budget-item.schema';

function correctedPurchaseCurrency(
  current: string | null | undefined,
  requested: string | undefined,
): string | null | undefined {
  // Eligibility can be unknown even when the original denomination is recorded.
  const missing =
    current == null || (typeof current === 'string' && current.trim() === '');
  if (requested !== undefined && requested !== current && !missing) {
    throw new ConflictException({
      code: 'purchase_currency_locked',
      message:
        'Keep the recorded purchase currency. Provide a verified currency only when the original value is absent or blank.',
    });
  }
  return requested ?? current;
}

function legacyHistoryRetained() {
  return new ConflictException({
    code: 'legacy_closed_transaction_retained',
    message:
      'Keep this transaction and its original assignment. Its closed budget has no final report available to audit changes to this purchase.',
  });
}

@Injectable()
export class TransactionsService {
  constructor(
    @InjectModel(Transaction.name)
    private transactionModel: Model<TransactionDocument>,
    @InjectModel(Budget.name) private budgets: Model<BudgetDocument>,
    @InjectModel(BudgetItem.name) private items: Model<BudgetItemDocument>,
    private readonly closedHistory: ClosedPeriodHistoryService,
  ) {}

  private async closedAssignmentBudget(
    current: Pick<Transaction, 'budgetItemId'>,
    owner: Types.ObjectId,
    session: ClientSession,
  ) {
    const itemId = current.budgetItemId?.toString();
    if (!itemId || !Types.ObjectId.isValid(itemId)) return;

    // Retired items and parents can still be the only original association.
    const item = await this.items
      .findOne(
        { _id: new Types.ObjectId(itemId), userId: owner },
        { budgetId: 1 },
        { session },
      )
      .lean()
      .exec();
    if (!item) return;
    const budget = await this.budgets
      .findOne(
        { _id: item.budgetId, userId: owner, status: 'closed' },
        { _id: 1 },
        { session },
      )
      .lean()
      .exec();
    return budget?._id;
  }

  private async validateAssignment(
    userId: string,
    itemId: string,
    type: string,
    date: Date,
    currency: unknown,
    session: ClientSession,
    retainedReportBudgets: string[] = [],
  ) {
    if (!Types.ObjectId.isValid(itemId))
      throw new BadRequestException(
        'Budget item is unavailable; choose another item',
      );
    const item = await this.items
      .findOne(
        {
          _id: new Types.ObjectId(itemId),
          userId: new Types.ObjectId(userId),
          isDeleted: false,
        },
        null,
        { session },
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
          { session },
        )
        .exec());
    if (!item || !budget) {
      throw new BadRequestException(
        'Budget item is unavailable; choose another item',
      );
    }
    if (
      budget.status === 'closed' &&
      retainedReportBudgets.includes(String(budget._id))
    )
      return item;
    if (budget.status !== 'active') {
      throw new BadRequestException('Budget must be active for assignment');
    }
    if (!supportedBudgetCurrency(budget.currencyContext))
      throw new BadRequestException(
        'Resolve budget planning currency explicitly as DOP before assignment',
      );
    const issue = currencyIssue(currency);
    if (issue)
      throw new BadRequestException(
        issue === 'unknown_currency'
          ? 'Transaction currency is unknown; explicitly correct the purchase currency before assignment'
          : 'Only DOP transactions can be assigned; keep unsupported purchases for review without conversion',
      );
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
    currency: unknown,
    session: ClientSession,
    closedPeriod: boolean,
  ) {
    const itemId = dto.budgetItemId;
    const assigned = typeof itemId === 'string';
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
    if (assigned && closedPeriod)
      throw new ConflictException({
        code: 'closed_period_assignment',
        message:
          'The purchase date is in a finalized period. Keep the historical link or save the purchase without an active assignment.',
      });
    if (assigned) {
      await this.validateAssignment(
        userId,
        itemId,
        type,
        date,
        currency,
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
    const owner = new Types.ObjectId(userId);
    const date = new Date(createTransactionDto.date);
    const links = await this.closedHistory.links(owner, [date], session);
    const covered = links.filter((report) =>
      this.closedHistory.isCovered([report], date),
    );
    const itemId = createTransactionDto.budgetItemId;
    let dto = createTransactionDto;
    if (covered.length && typeof itemId === 'string') {
      // A create that loses the close race may still arrive for the old item.
      // Verify the intent belongs to this period, then retain the purchase for review.
      const item = await this.validateAssignment(
        userId,
        itemId,
        dto.type,
        date,
        dto.currency ?? 'DOP',
        session,
        covered.map((report) => report.budgetId.toString()),
      );
      if (
        !covered.some((report) => report.budgetId.equals(item.budgetId)) ||
        item.type !== dto.type
      )
        throw new ConflictException(
          'Choose no assignment for a purchase in a finalized period',
        );
      dto = {
        ...dto,
        budgetItemId: null,
        matchingStatus: 'needs_review',
        matchingSource: undefined,
        matchingConfidence: undefined,
      };
    }
    const assignment = await this.assignment(
      userId,
      dto,
      createTransactionDto.type,
      createTransactionDto.date,
      createTransactionDto.currency ?? 'DOP',
      session,
      covered.length > 0,
    );
    const createdTransaction = new this.transactionModel({
      ...dto,
      ...assignment,
      currency: createTransactionDto.currency ?? 'DOP',
      currencyContextVersion: 1,
      currencyOrigin:
        createTransactionDto.currency === undefined
          ? 'manual-default'
          : 'explicit',
      userId: new Types.ObjectId(userId),
      accountId: createTransactionDto.accountId
        ? new Types.ObjectId(createTransactionDto.accountId)
        : undefined,
    });
    const saved = await createdTransaction.save({ session });
    await this.closedHistory.record(
      owner,
      saved._id,
      links,
      null,
      saved,
      session,
    );
    return saved;
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
        .sort({ date: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.transactionModel.countDocuments(query).exec(),
    ]);

    return {
      data: await this.withHistoryContext(userId, data),
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
    return (await this.withHistoryContext(userId, [transaction]))[0];
  }

  private async withHistoryContext(
    userId: string,
    transactions: TransactionDocument[],
  ) {
    const references = new Set(
      transactions.flatMap(({ budgetItemId }) =>
        budgetItemId ? [budgetItemId.toString()] : [],
      ),
    );
    const owner = new Types.ObjectId(userId);
    const flagged = await this.closedHistory.transactionIdsWithExceptions(
      owner,
      transactions.map((row) => row._id),
    );
    // Include retained soft-deleted rows to preserve historical labels.
    const items = references.size
      ? await this.items
          .find(
            {
              userId: owner,
              _id: {
                $in: [...references].filter((value) =>
                  Types.ObjectId.isValid(value),
                ),
              },
            },
            { name: 1, budgetId: 1 },
          )
          .lean()
          .exec()
      : [];
    const parents = items.length
      ? await this.budgets
          .find(
            { userId: owner, _id: { $in: items.map((item) => item.budgetId) } },
            { name: 1, status: 1 },
          )
          .lean()
          .exec()
      : [];
    const byItem = new Map(items.map((item) => [item._id.toString(), item]));
    const byBudget = new Map(
      parents.map((budget) => [budget._id.toString(), budget]),
    );
    return transactions.map((transaction) => {
      const item = byItem.get(
        transaction.budgetItemId?.toString().toLowerCase() ?? '',
      );
      const budget = item && byBudget.get(item.budgetId.toString());
      const hasClosedPeriodExceptions = flagged.has(String(transaction._id));
      if ((!item || !budget) && !hasClosedPeriodExceptions) return transaction;
      return {
        ...transaction.toObject(),
        ...(hasClosedPeriodExceptions ? { hasClosedPeriodExceptions } : {}),
        ...(item && budget
          ? {
              assignmentContext: {
                budgetItemId: item._id,
                budgetItemName: item.name,
                budgetId: budget._id,
                budgetName: budget.name,
                budgetStatus: budget.status,
              },
            }
          : {}),
      };
    });
  }

  async update(
    id: string,
    userId: string,
    updateTransactionDto: UpdateTransactionDto,
  ): Promise<Transaction> {
    return coverageWrite(this.transactionModel.db, userId, (session) =>
      this.updateExisting(id, userId, updateTransactionDto, session),
    );
  }

  private async rememberAssignment(
    current: Transaction,
    userId: string,
    dto: UpdateTransactionDto,
    session: ClientSession,
  ): Promise<void> {
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
    if (
      current.type !== 'expense' ||
      (dto.type ?? current.type) !== 'expense'
    ) {
      throw new BadRequestException('Remember is available only for expenses');
    }
    const item = await this.validateAssignment(
      userId,
      dto.budgetItemId,
      'expense',
      dto.date ?? current.date,
      correctedPurchaseCurrency(current.currency, dto.currency),
      session,
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
            session,
            runValidators: true,
            ...(equivalent
              ? { arrayFilters: [{ 'rule.id': equivalent.id }] }
              : {}),
          },
        )
        .exec();
      if (written.matchedCount !== 1) {
        throw new BadRequestException('Budget item changed; reload and retry');
      }
    }
  }

  private async updateExisting(
    id: string,
    userId: string,
    updateTransactionDto: UpdateTransactionDto,
    session: ClientSession,
  ): Promise<Transaction> {
    const { rememberMerchant, merchantKeyword, ...transactionFields } =
      updateTransactionDto;
    void merchantKeyword;
    const updateData: Record<string, unknown> = { ...transactionFields };
    const unset: Record<string, 1> = {};
    const filter = {
      _id: new Types.ObjectId(id),
      userId: new Types.ObjectId(userId),
    };
    const current = await this.transactionModel
      .findOne(filter, null, { session, lean: true })
      .exec();
    if (!current) throw new NotFoundException('Transaction is unavailable');
    const currency = correctedPurchaseCurrency(
      current.currency,
      updateTransactionDto.currency,
    );
    const resolvesCurrency =
      updateTransactionDto.currency !== undefined &&
      currency !== current.currency;
    if (resolvesCurrency) {
      updateData.currencyContextVersion = 1;
      updateData.currencyOrigin = 'explicit-resolution';
    } else {
      delete updateData.currency;
    }
    const checksAssignment =
      typeof updateTransactionDto.budgetItemId === 'string' ||
      (updateTransactionDto.budgetItemId === undefined &&
        (updateTransactionDto.date !== undefined ||
          resolvesCurrency ||
          updateTransactionDto.type !== undefined));
    const date = new Date(updateTransactionDto.date ?? current.date);
    const links = await this.closedHistory.links(
      filter.userId,
      [current.date, date],
      session,
      filter._id,
    );
    const closedBudget = await this.closedAssignmentBudget(
      current,
      filter.userId,
      session,
    );
    if (
      closedBudget &&
      !links.some((report) => report.budgetId.equals(closedBudget))
    ) {
      throw legacyHistoryRetained();
    }
    if (rememberMerchant === true) {
      await this.rememberAssignment(
        current,
        userId,
        updateTransactionDto,
        session,
      );
    }
    const retainedReportBudgets = links
      .filter((report) =>
        report.includedTransactionIds?.includes(filter._id.toString()),
      )
      .map((report) => report.budgetId.toString());
    const closedPeriod = this.closedHistory.isCovered(links, date);
    if (checksAssignment) {
      // Validate and write against the same effective transaction values.
      Object.assign(filter, {
        date: current.date,
        type: current.type,
        // Match the raw legacy values without Mongoose casting string item IDs.
        $expr: {
          $and: [
            {
              $eq: [
                { $ifNull: ['$currency', null] },
                { $literal: current.currency ?? null },
              ],
            },
            {
              $eq: [
                { $ifNull: ['$budgetItemId', null] },
                { $literal: current.budgetItemId ?? null },
              ],
            },
          ],
        },
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
          currency,
          session,
          retainedReportBudgets,
        );
      }
    }
    if (updateTransactionDto.budgetItemId !== undefined) {
      const assignment = await this.assignment(
        userId,
        updateTransactionDto,
        updateTransactionDto.type ?? current.type,
        date,
        currency,
        session,
        closedPeriod,
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
        { new: true, runValidators: true, session, lean: true },
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

    await this.closedHistory.record(
      filter.userId,
      filter._id,
      links,
      current,
      existingTransaction,
      session,
    );
    return this.transactionModel.hydrate(existingTransaction);
  }

  async exceptions(id: string, userId: string, page: number, limit: number) {
    if (!Types.ObjectId.isValid(id))
      throw new NotFoundException('Transaction is unavailable');
    const transactionId = new Types.ObjectId(id);
    if (
      !(await this.transactionModel
        .exists({ _id: transactionId, userId: new Types.ObjectId(userId) })
        .exec())
    )
      throw new NotFoundException('Transaction is unavailable');
    return this.closedHistory.listForTransaction(
      userId,
      transactionId,
      page,
      limit,
    );
  }

  async remove(id: string, userId: string): Promise<void> {
    if (!Types.ObjectId.isValid(id))
      throw new NotFoundException('Transaction is unavailable');
    const filter = {
      _id: new Types.ObjectId(id),
      userId: new Types.ObjectId(userId),
    };
    await coverageWrite(this.transactionModel.db, userId, async (session) => {
      await this.closedHistory.protectDeletion(
        filter.userId,
        filter._id,
        session,
      );
      const current = await this.transactionModel
        .findOne(filter, { budgetItemId: 1 }, { session, lean: true })
        .exec();
      if (!current) throw new NotFoundException('Transaction is unavailable');
      if (await this.closedAssignmentBudget(current, filter.userId, session)) {
        throw legacyHistoryRetained();
      }
      const deleted = await this.transactionModel
        .findOneAndDelete(filter, { session })
        .exec();
      if (!deleted) throw new NotFoundException('Transaction is unavailable');
      return true;
    });
  }
}
