import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { ClientSession, Model, Types } from 'mongoose';
import {
  budgetCoverage,
  coverageDateFilter,
  coverageOverlaps,
  validateCoverage,
  validateFinalCutoff,
} from './budget-coverage';
import { coverageWrite } from './coverage-write';
import { Budget, BudgetDocument } from './schemas/budget.schema';
import { BudgetItem, BudgetItemDocument } from './schemas/budget-item.schema';
import {
  Transaction,
  TransactionDocument,
} from '@/modules/transactions/schemas/transaction.schema';
import { CreateBudgetDto, CreateBudgetItemDto } from './dto/create-budget.dto';
import { UpdateBudgetItemDto } from './dto/update-budget-item.dto';
import { UpdateBudgetDto } from './dto/update-budget.dto';
import { ActivateBudgetDto, CopyBudgetDraftDto } from './dto/next-budget.dto';
import { BudgetPeriodReport } from '../reports/schemas/budget-period-report.schema';
import { matchingRulesError } from './matching-rule-validation';
import {
  CurrencyIssue,
  currencyIssue,
  dopPlanningContext,
  supportedBudgetCurrency,
} from './currency-policy';

export type BudgetItemWithSpent = BudgetItem & {
  _id: Types.ObjectId;
  spent: number;
  spentCurrency: 'DOP';
  actualsComplete: boolean;
  currencyIssues: CurrencyIssue[];
};
export type BudgetWithItems = Budget & {
  _id: Types.ObjectId;
  items: BudgetItemWithSpent[];
  actualsCurrency: 'DOP';
  actualsComplete: boolean;
  currencyIssues: CurrencyIssue[];
  currencyContextResolved: boolean;
};

@Injectable()
export class BudgetsService {
  constructor(
    @InjectModel(Budget.name) private budgetModel: Model<BudgetDocument>,
    @InjectModel(BudgetItem.name)
    private budgetItemModel: Model<BudgetItemDocument>,
    @InjectModel(Transaction.name)
    private transactionModel: Model<TransactionDocument>,
  ) {}

  async create(
    userId: string,
    createBudgetDto: CreateBudgetDto,
  ): Promise<BudgetWithItems> {
    const { items, ...budgetData } = createBudgetDto;
    this.validateItems(items);

    const data = this.lifecycleData(budgetData);
    if (data.status === 'closed')
      throw new BadRequestException(
        'Create a draft or active budget before closing',
      );
    return this.createWithItems(userId, data, () => items);
  }

  async copyDraft(
    sourceId: string,
    userId: string,
    dto: CopyBudgetDraftDto,
  ): Promise<BudgetWithItems> {
    this.requireBudgetId(sourceId);
    const data = this.lifecycleData({ ...dto, status: 'draft' });
    return this.createWithItems(userId, data, async (session) => {
      const source = await this.budgetModel
        .findOne(
          {
            _id: new Types.ObjectId(sourceId),
            userId: new Types.ObjectId(userId),
            isDeleted: false,
            deletedAt: null,
          },
          null,
          { session },
        )
        .exec();
      if (!source) throw new NotFoundException('Source budget not found');
      if (source.status !== 'active' && source.status !== 'closed')
        throw new BadRequestException('Copy an active or closed budget');
      if (!supportedBudgetCurrency(source.currencyContext))
        throw new BadRequestException(
          'Resolve source budget planning currency explicitly as DOP before copying',
        );

      const retained = await this.budgetItemModel
        .find(
          {
            budgetId: source._id,
            userId: source.userId,
            isDeleted: false,
            deletedAt: null,
          },
          {
            name: 1,
            description: 1,
            type: 1,
            plannedAmount: 1,
            icon: 1,
            color: 1,
            alertEnabled: 1,
            matchingRules: 1,
          },
          { session },
        )
        .lean()
        .exec();
      return retained.map(({ _id, ...configuration }) => {
        const ruleError =
          configuration.matchingRules === undefined
            ? undefined
            : matchingRulesError(configuration.matchingRules);
        if (
          ruleError ||
          validateSync(plainToInstance(CreateBudgetItemDto, configuration))
            .length
        )
          throw new BadRequestException({
            code: 'invalid_source_item',
            message: ruleError ?? 'Source item configuration is invalid',
            itemId: _id.toString(),
          });
        return configuration;
      });
    });
  }

  private async createWithItems(
    userId: string,
    data: Budget,
    loadItems: (
      session: ClientSession,
    ) => CreateBudgetItemDto[] | undefined | Promise<CreateBudgetItemDto[]>,
  ): Promise<BudgetWithItems> {
    const userObjectId = new Types.ObjectId(userId);
    const id = await coverageWrite(
      this.budgetModel.db,
      userId,
      async (session) => {
        if (data.status === 'active') {
          const cutoff = await this.activationCutoff(userObjectId, session);
          this.validateActivationStart(data.startDate, cutoff);
        }
        const items = await loadItems(session);
        const saved = await new this.budgetModel({
          ...data,
          userId: userObjectId,
        }).save({ session });
        if (items?.length)
          await this.budgetItemModel.insertMany(
            items.map((item) => ({
              ...item,
              budgetId: saved._id,
              userId: userObjectId,
            })),
            { session },
          );
        return saved._id.toString();
      },
    );
    return this.findOne(id, userId);
  }

  async findAll(userId: string): Promise<BudgetWithItems[]> {
    const budgets = await this.budgetModel
      .find({ userId: new Types.ObjectId(userId), isDeleted: false })
      .exec();

    if (budgets.length === 0) return [];

    const budgetIds = budgets.map((b) => b._id);
    const allItems = await this.budgetItemModel
      .find({
        budgetId: { $in: budgetIds },
        userId: new Types.ObjectId(userId),
        isDeleted: false,
      })
      .exec();

    const itemsByBudget = new Map<string, BudgetItemDocument[]>();
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
          ...budget.toObject<Budget & { _id: Types.ObjectId }>(),
          ...items,
        };
      }),
    );

    return budgetsWithSpent;
  }

  async findOne(id: string, userId: string): Promise<BudgetWithItems> {
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
      .find({ budgetId: budget._id, userId: budget.userId, isDeleted: false })
      .exec();

    const items = await this.appendSpentToItems(budget, budgetItems);

    return {
      ...budget.toObject<Budget & { _id: Types.ObjectId }>(),
      ...items,
    };
  }

  async update(
    id: string,
    userId: string,
    updateBudgetDto: UpdateBudgetDto,
  ): Promise<BudgetWithItems> {
    return this.updateInCoverage(id, userId, updateBudgetDto, false);
  }

  async activate(
    id: string,
    userId: string,
    dto: ActivateBudgetDto,
  ): Promise<BudgetWithItems> {
    return this.updateInCoverage(
      id,
      userId,
      { ...dto, status: 'active' },
      true,
    );
  }

  private requireBudgetId(id: string): void {
    if (!Types.ObjectId.isValid(id))
      throw new NotFoundException('Budget not found');
  }

  private async updateInCoverage(
    id: string,
    userId: string,
    dto: UpdateBudgetDto,
    activationOnly: boolean,
  ): Promise<BudgetWithItems> {
    this.requireBudgetId(id);
    const updateBudgetDto = Object.fromEntries(
      Object.entries(dto).filter(([, value]) => value !== undefined),
    ) as UpdateBudgetDto;
    const { items, ...budgetData } = updateBudgetDto;
    this.validateItems(items);
    const userObjectId = new Types.ObjectId(userId);
    const budgetObjectId = new Types.ObjectId(id);

    await coverageWrite(this.budgetModel.db, userId, async (session) => {
      const current = await this.budgetModel
        .findOne(
          { _id: budgetObjectId, userId: userObjectId, isDeleted: false },
          null,
          { session },
        )
        .exec();
      if (!current) throw new NotFoundException(`Budget #${id} not found`);
      if (budgetData.status === 'closed')
        throw new BadRequestException(
          'Use POST /budgets/:id/close-preview and POST /budgets/:id/close to confirm closure',
        );
      if (
        budgetData.currency !== undefined &&
        current.status === 'closed' &&
        current.currencyContext
      )
        throw new BadRequestException(
          'Closed budget currency context cannot be changed',
        );
      const changesCoverage = [
        'status',
        'startDate',
        'timezone',
        'actualCutoffDate',
        'closeThroughDate',
      ].some((key) => Object.hasOwn(budgetData, key));
      if (
        current.coverageVersion !== 1 &&
        (changesCoverage || Object.hasOwn(budgetData, 'endDate'))
      )
        throw new BadRequestException(
          'Legacy coverage requires explicit migration before lifecycle changes',
        );
      if (current.status === 'closed') {
        if (
          !current.currencyContext &&
          budgetData.currency === 'DOP' &&
          Object.keys(budgetData).filter(
            (key) => budgetData[key as keyof typeof budgetData] !== undefined,
          ).length === 1 &&
          items === undefined
        ) {
          await this.budgetModel
            .updateOne(
              { _id: budgetObjectId, userId: userObjectId, isDeleted: false },
              {
                $set: {
                  currencyContext: {
                    version: 1,
                    currency: 'DOP',
                    origin: 'explicit-resolution',
                  },
                },
              },
              { session, runValidators: true },
            )
            .exec();
          return true;
        }
        throw new BadRequestException(
          'Final closed budget configuration cannot be changed or reopened',
        );
      }
      if (
        (current.status !== 'draft' || budgetData.status === 'active') &&
        budgetData.timezone !== undefined &&
        budgetData.timezone !== current.timezone
      )
        throw new BadRequestException('Timezone is preserved after activation');
      if (current.status === 'active' && budgetData.status === 'draft')
        throw new BadRequestException('Active budgets require manual closure');
      if (activationOnly && current.status === 'active') {
        if (
          budgetData.startDate !== undefined &&
          new Date(budgetData.startDate).getTime() !==
            current.startDate.getTime()
        )
          throw new ConflictException(
            'Budget is already active with a different start date',
          );
        return true;
      }
      const activating =
        current.status === 'draft' && budgetData.status === 'active';
      let priorCutoff: Date | undefined;
      if (activating) {
        if (current.actualCutoffDate != null || current.closedAt != null)
          throw new BadRequestException(
            'Resolve invalid draft closure fields before activation',
          );
        priorCutoff = await this.activationCutoff(userObjectId, session);
      }
      const attemptData = {
        ...budgetData,
        startDate: budgetData.startDate ?? priorCutoff?.toISOString(),
      };
      const data =
        current.coverageVersion === 1
          ? this.lifecycleData(attemptData, current)
          : { ...budgetData };
      if (budgetData.currency === 'DOP')
        (data as Budget).currencyContext = {
          version: 1,
          currency: 'DOP',
          origin: 'explicit-resolution',
        };
      if (activating) {
        if (!supportedBudgetCurrency((data as Budget).currencyContext))
          throw new BadRequestException(
            'Resolve draft planning currency explicitly as DOP before activation',
          );
        this.validateActivationStart((data as Budget).startDate, priorCutoff);
      }
      if (current.coverageVersion === 1)
        await this.validateLifecycle(
          userId,
          data as Budget,
          current,
          session,
          activating,
        );
      await this.budgetModel
        .updateOne(
          { _id: budgetObjectId, userId: userObjectId, isDeleted: false },
          { $set: data },
          { session, runValidators: true },
        )
        .exec();
      if (items?.length)
        for (const item of items)
          await new this.budgetItemModel({
            ...item,
            budgetId: budgetObjectId,
            userId: userObjectId,
          }).save({ session });
      return true;
    });

    return this.findOne(id, userId);
  }

  async softDelete(id: string, userId: string): Promise<BudgetDocument> {
    return coverageWrite(this.budgetModel.db, userId, (session) =>
      this.softDeleteInSession(id, userId, session),
    );
  }

  private async softDeleteInSession(
    id: string,
    userId: string,
    session: ClientSession,
  ): Promise<BudgetDocument> {
    const userObjectId = new Types.ObjectId(userId);
    const budgetObjectId = new Types.ObjectId(id);

    const budget = await this.requireMutableBudget(id, userId, session);
    if (budget.status === 'active')
      throw new BadRequestException(
        'Close the active budget before replacement',
      );

    const deletedBudget = await this.budgetModel
      .findOneAndUpdate(
        { _id: budgetObjectId, userId: userObjectId, isDeleted: false },
        { $set: { isDeleted: true, deletedAt: new Date() } },
        { new: true, session },
      )
      .exec();

    if (!deletedBudget) {
      throw new NotFoundException(`Budget #${id} not found`);
    }

    // Soft delete associated items
    await this.budgetItemModel
      .updateMany(
        { budgetId: budgetObjectId, userId: userObjectId, isDeleted: false },
        { $set: { isDeleted: true, deletedAt: new Date() } },
        { session },
      )
      .exec();

    return deletedBudget;
  }

  async softDeleteBudgetItem(
    budgetId: string,
    itemId: string,
    userId: string,
  ): Promise<BudgetItemDocument> {
    return coverageWrite(this.budgetModel.db, userId, (session) =>
      this.softDeleteItemInSession(budgetId, itemId, userId, session),
    );
  }

  private async softDeleteItemInSession(
    budgetId: string,
    itemId: string,
    userId: string,
    session: ClientSession,
  ): Promise<BudgetItemDocument> {
    await this.requireMutableBudget(budgetId, userId, session);
    const deletedItem = await this.budgetItemModel
      .findOneAndUpdate(
        {
          _id: new Types.ObjectId(itemId),
          budgetId: new Types.ObjectId(budgetId),
          userId: new Types.ObjectId(userId),
          isDeleted: false,
        },
        { $set: { isDeleted: true, deletedAt: new Date() } },
        { new: true, session },
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
    createItemDto: CreateBudgetItemDto,
  ): Promise<BudgetItemDocument> {
    this.validateRules(createItemDto.matchingRules);
    const userObjectId = new Types.ObjectId(userId);
    const budgetObjectId = new Types.ObjectId(budgetId);

    return coverageWrite(this.budgetModel.db, userId, async (session) => {
      await this.requireMutableBudget(budgetId, userId, session);
      return new this.budgetItemModel({
        ...createItemDto,
        budgetId: budgetObjectId,
        userId: userObjectId,
      }).save({ session });
    });
  }

  async updateBudgetItem(
    budgetId: string,
    itemId: string,
    userId: string,
    updateDto: UpdateBudgetItemDto,
  ): Promise<BudgetItemDocument> {
    this.validateRules(updateDto.matchingRules);
    const updates = Object.fromEntries(
      Object.entries(updateDto).filter(([, value]) => value !== undefined),
    );
    return coverageWrite(this.budgetModel.db, userId, async (session) => {
      await this.requireMutableBudget(budgetId, userId, session);
      const updatedItem = await this.budgetItemModel
        .findOneAndUpdate(
          {
            _id: new Types.ObjectId(itemId),
            budgetId: new Types.ObjectId(budgetId),
            userId: new Types.ObjectId(userId),
            isDeleted: false,
          },
          { $set: updates },
          { new: true, runValidators: true, session },
        )
        .exec();

      if (!updatedItem) {
        throw new NotFoundException(`Budget item #${itemId} not found`);
      }
      return updatedItem;
    });
  }

  private async requireMutableBudget(
    budgetId: string,
    userId: string,
    session: ClientSession,
  ) {
    const budget = await this.budgetModel
      .findOne(
        {
          _id: new Types.ObjectId(budgetId),
          userId: new Types.ObjectId(userId),
          isDeleted: false,
        },
        { status: 1 },
        { session },
      )
      .exec();
    if (!budget) throw new NotFoundException(`Budget #${budgetId} not found`);
    if (budget.status === 'closed')
      throw new BadRequestException(
        'Closed budget configuration and history are read-only',
      );
    return budget;
  }
  private validateRules(rules: unknown): void {
    if (rules === undefined) return;
    const error = matchingRulesError(rules);
    if (error) throw new BadRequestException(error);
  }

  private lifecycleData(
    dto: Partial<CreateBudgetDto>,
    current?: Budget,
  ): Budget {
    const data = {
      ...(current
        ? {
            name: current.name,
            periodType: current.periodType,
            status: current.status,
            startDate: current.startDate,
            plannedEndDate: current.plannedEndDate,
            endDate: current.endDate,
            actualCutoffDate: current.actualCutoffDate,
            closedAt: current.closedAt,
            timezone: current.timezone,
            currencyContext: current.currencyContext,
          }
        : {}),
      ...dto,
      coverageVersion: 1,
      ...(!current ? { currencyContext: dopPlanningContext() } : {}),
    } as unknown as Budget;
    data.startDate = new Date(dto.startDate ?? current?.startDate ?? NaN);
    if (
      dto.endDate !== undefined &&
      dto.plannedEndDate !== undefined &&
      new Date(dto.endDate).getTime() !== new Date(dto.plannedEndDate).getTime()
    )
      throw new BadRequestException(
        'endDate is an alias of plannedEndDate; values must agree',
      );
    const planned =
      dto.plannedEndDate ?? dto.endDate ?? current?.plannedEndDate;
    if (planned !== undefined)
      data.endDate = data.plannedEndDate = new Date(planned);
    if (
      dto.actualCutoffDate !== undefined ||
      dto.closeThroughDate !== undefined
    )
      throw new BadRequestException(
        'Actual cutoff is accepted only with manual closure',
      );
    try {
      validateCoverage(budgetCoverage(data));
      if (
        data.plannedEndDate &&
        (!Number.isFinite(data.plannedEndDate.getTime()) ||
          data.plannedEndDate <= data.startDate)
      )
        throw new Error('Planned end must follow coverage start');
    } catch (error) {
      throw new BadRequestException((error as Error).message);
    }
    return data;
  }

  private async validateLifecycle(
    userId: string,
    data: Budget,
    current: BudgetDocument,
    session: ClientSession,
    activating: boolean,
  ): Promise<void> {
    const owner = new Types.ObjectId(userId);
    if (data.status !== 'draft' && !activating) {
      const others = await this.budgetModel
        .find(
          {
            userId: owner,
            isDeleted: false,
            status: { $in: ['active', 'closed'] },
            _id: { $ne: current._id },
          },
          null,
          { session },
        )
        .exec();
      for (const other of others) {
        if (data.status === 'active' && other.status === 'active')
          throw new BadRequestException(
            'Only one active budget is allowed; close the current budget first',
          );
        const otherCoverage = this.retainedCoverage(other);
        if (coverageOverlaps(budgetCoverage(data), otherCoverage))
          throw new BadRequestException(
            'Coverage overlaps another active or closed budget',
          );
      }
    }
    const items = await this.budgetItemModel
      .find({ budgetId: current._id, userId: owner }, null, { session })
      .exec();
    const refs = items.flatMap((item) => [item._id, item._id.toString()]);
    const outside = await this.transactionModel
      .find(
        {
          userId: owner,
          budgetItemId: { $in: refs },
          $or: [
            { date: { $lt: data.startDate } },
            ...(data.actualCutoffDate
              ? [{ date: { $gte: data.actualCutoffDate } }]
              : []),
          ],
        },
        { _id: 1, date: 1, budgetItemId: 1 },
        { session },
      )
      .limit(21)
      .exec();
    if (outside.length)
      throw new BadRequestException({
        message:
          'Coverage would exclude saved assignments. Correct dates, clear or reassign these transactions before retrying',
        affectedTransactions: outside.slice(0, 20).map((t) => ({
          id: t._id.toString(),
          date: t.date,
          budgetItemId: t.budgetItemId?.toString(),
        })),
        hasMore: outside.length > 20,
      });
  }

  private retainedCoverage(budget: Budget) {
    try {
      if (budget.coverageVersion !== 1)
        throw new Error('Coverage version is unresolved');
      const coverage = budgetCoverage(budget);
      if (budget.status === 'closed')
        validateFinalCutoff(coverage, budget.closedAt!, new Date());
      else validateCoverage(coverage);
      return coverage;
    } catch {
      throw new BadRequestException(
        'Resolve legacy or invalid retained coverage before activation',
      );
    }
  }

  private async activationCutoff(
    owner: Types.ObjectId,
    session: ClientSession,
  ) {
    const retained = await this.budgetModel
      .find(
        {
          userId: owner,
          isDeleted: false,
          status: { $in: ['active', 'closed'] },
        },
        null,
        { session },
      )
      .exec();
    if (retained.some((budget) => budget.status === 'active'))
      throw new ConflictException(
        'Only one active budget is allowed; close the current budget first',
      );
    let previous: BudgetDocument | undefined;
    let cutoff: Date | undefined;
    for (const budget of retained) {
      const boundary = this.retainedCoverage(budget).actualCutoffDate!;
      if (!cutoff || boundary > cutoff) {
        previous = budget;
        cutoff = boundary;
      }
    }
    if (previous) {
      const confirmed = await this.budgetModel.db
        .model<BudgetPeriodReport>(BudgetPeriodReport.name)
        .exists({
          userId: owner,
          budgetId: previous._id,
          snapshotVersion: 1,
          actualCutoffDate: cutoff,
          closedAt: previous.closedAt,
          startDate: previous.startDate,
          timezone: previous.timezone,
        })
        .session(session)
        .exec();
      if (!confirmed)
        throw new BadRequestException(
          'The prior budget requires a confirmed final report before activation',
        );
    }
    return cutoff;
  }

  private validateActivationStart(start: Date, cutoff?: Date): void {
    if (cutoff && start < cutoff)
      throw new BadRequestException(
        'Coverage overlaps a closed budget; start at or after the prior actual cutoff',
      );
  }

  private validateItems(items: unknown): void {
    if (items === undefined) return;
    if (!Array.isArray(items))
      throw new BadRequestException('items must be an array');
    for (const item of items) {
      if (!item || typeof item !== 'object') {
        throw new BadRequestException('items must contain item objects');
      }
      this.validateRules((item as CreateBudgetItemDto).matchingRules);
    }
  }

  private async appendSpentToItems(
    budget: Budget,
    budgetItems: BudgetItemDocument[],
  ): Promise<
    Pick<
      BudgetWithItems,
      | 'items'
      | 'actualsCurrency'
      | 'actualsComplete'
      | 'currencyIssues'
      | 'currencyContextResolved'
    >
  > {
    const transactions = await this.transactionModel.aggregate<{
      _id: Types.ObjectId | null;
      totalSpent: number;
      currencyIssues?: (CurrencyIssue | null)[];
    }>([
      {
        $match: {
          userId: budget.userId,
          date: {
            ...coverageDateFilter(budgetCoverage(budget)),
            $lte: new Date(),
          },
        },
      },
      {
        $addFields: {
          normalizedBudgetItemId: {
            $convert: {
              input: '$budgetItemId',
              to: 'objectId',
              onError: null,
              onNull: null,
            },
          },
        },
      },
      {
        $group: {
          _id: '$normalizedBudgetItemId',
          totalSpent: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$currency', 'DOP'] },
                    { $eq: ['$type', 'expense'] },
                  ],
                },
                { $abs: '$amount' },
                0,
              ],
            },
          },
          currencyIssues: {
            $push: {
              $cond: [
                { $eq: ['$currency', 'DOP'] },
                null,
                {
                  transactionId: { $toString: '$_id' },
                  budgetItemId: {
                    $convert: {
                      input: '$budgetItemId',
                      to: 'string',
                      onError: null,
                      onNull: null,
                    },
                  },
                  currency: { $ifNull: ['$currency', null] },
                },
              ],
            },
          },
        },
      },
    ]);

    const spentMap = new Map<string, number>();
    for (const t of transactions) {
      if (t._id) spentMap.set(t._id.toString(), t.totalSpent);
    }
    const currencyIssues = transactions
      .flatMap((t) =>
        (t.currencyIssues ?? []).filter(
          (issue): issue is CurrencyIssue => issue !== null,
        ),
      )
      .map((issue) => ({ ...issue, code: currencyIssue(issue.currency)! }));
    const currencyContextResolved = supportedBudgetCurrency(
      budget.currencyContext,
    );
    return {
      actualsCurrency: 'DOP',
      currencyContextResolved,
      actualsComplete: currencyContextResolved && currencyIssues.length === 0,
      currencyIssues,
      items: budgetItems.map((item) => ({
        ...item.toObject<BudgetItem & { _id: Types.ObjectId }>(),
        spent: this.roundCurrency(spentMap.get(item._id.toString()) || 0),
        spentCurrency: 'DOP' as const,
        actualsComplete:
          currencyContextResolved &&
          !currencyIssues.some(
            (issue) => issue.budgetItemId === item._id.toString(),
          ),
        currencyIssues: currencyIssues.filter(
          (issue) => issue.budgetItemId === item._id.toString(),
        ),
      })),
    };
  }

  private roundCurrency(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }
}
