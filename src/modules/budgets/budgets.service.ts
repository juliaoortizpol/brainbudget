import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model, Types } from 'mongoose';
import {
  budgetCoverage,
  completedDayCutoff,
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
import { matchingRulesError } from './matching-rule-validation';

export type BudgetItemWithSpent = BudgetItem & {
  _id: Types.ObjectId;
  spent: number;
};
export type BudgetWithItems = Budget & {
  _id: Types.ObjectId;
  items: BudgetItemWithSpent[];
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
    const userObjectId = new Types.ObjectId(userId);

    const data = this.lifecycleData(budgetData);
    if (data.status === 'closed')
      throw new BadRequestException(
        'Create a draft or active budget before closing',
      );
    const id = await coverageWrite(
      this.budgetModel.db,
      userId,
      async (session) => {
        await this.validateLifecycle(userId, data, undefined, session);
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
      .find({ budgetId: { $in: budgetIds }, isDeleted: false })
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
          items,
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
      .find({ budgetId: budget._id, isDeleted: false })
      .exec();

    const items = await this.appendSpentToItems(budget, budgetItems);

    return {
      ...budget.toObject<Budget & { _id: Types.ObjectId }>(),
      items,
    };
  }

  async update(
    id: string,
    userId: string,
    updateBudgetDto: UpdateBudgetDto,
  ): Promise<BudgetWithItems> {
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
      if (current.status === 'closed' && changesCoverage)
        throw new BadRequestException(
          'Final closed coverage cannot be changed or reopened',
        );
      if (
        current.status !== 'draft' &&
        budgetData.timezone !== undefined &&
        budgetData.timezone !== current.timezone
      )
        throw new BadRequestException('Timezone is preserved after activation');
      if (current.status === 'active' && budgetData.status === 'draft')
        throw new BadRequestException('Active budgets require manual closure');
      if (budgetData.status === 'closed' && current.status !== 'active')
        throw new BadRequestException('Only an active budget can be closed');
      const data =
        current.coverageVersion === 1
          ? this.lifecycleData(budgetData, current)
          : budgetData;
      if (current.coverageVersion === 1)
        await this.validateLifecycle(userId, data as Budget, current, session);
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
        { budgetId: budgetObjectId, isDeleted: false },
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
    updateDto: UpdateBudgetItemDto,
  ): Promise<BudgetItemDocument> {
    this.validateRules(updateDto.matchingRules);
    const updates = Object.fromEntries(
      Object.entries(updateDto).filter(([, value]) => value !== undefined),
    );
    const updatedItem = await this.budgetItemModel
      .findOneAndUpdate(
        {
          _id: new Types.ObjectId(itemId),
          budgetId: new Types.ObjectId(budgetId),
          userId: new Types.ObjectId(userId),
          isDeleted: false,
        },
        { $set: updates },
        { new: true, runValidators: true },
      )
      .exec();

    if (!updatedItem) {
      throw new NotFoundException(`Budget item #${itemId} not found`);
    }
    return updatedItem;
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
    const now = new Date();
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
          }
        : {}),
      ...dto,
      coverageVersion: 1,
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
    if (data.status === 'closed' && current?.status !== 'closed') {
      data.closedAt = now;
      if (
        dto.closeThroughDate !== undefined &&
        dto.actualCutoffDate !== undefined
      )
        throw new BadRequestException(
          'Choose an explicit cutoff or completed day, not both',
        );
      try {
        data.actualCutoffDate =
          dto.closeThroughDate !== undefined
            ? completedDayCutoff(dto.closeThroughDate, data.timezone!)
            : dto.actualCutoffDate === undefined
              ? now
              : new Date(dto.actualCutoffDate);
      } catch (error) {
        throw new BadRequestException((error as Error).message);
      }
    } else if (
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
      if (data.status === 'closed')
        validateFinalCutoff(budgetCoverage(data), data.closedAt!, now);
    } catch (error) {
      throw new BadRequestException((error as Error).message);
    }
    return data;
  }

  private async validateLifecycle(
    userId: string,
    data: Budget,
    current: BudgetDocument | undefined,
    session: ClientSession,
  ): Promise<void> {
    const owner = new Types.ObjectId(userId);
    if (data.status !== 'draft') {
      const others = await this.budgetModel
        .find(
          {
            userId: owner,
            isDeleted: false,
            status: { $in: ['active', 'closed'] },
            ...(current ? { _id: { $ne: current._id } } : {}),
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
        if (other.coverageVersion !== 1)
          throw new BadRequestException(
            'Resolve legacy coverage before activation or closure',
          );
        if (coverageOverlaps(budgetCoverage(data), budgetCoverage(other)))
          throw new BadRequestException(
            'Coverage overlaps another active or closed budget',
          );
      }
    }
    if (!current) return;
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
  ): Promise<BudgetItemWithSpent[]> {
    if (!budgetItems.length) return [];

    const transactions = await this.transactionModel.aggregate<{
      _id: Types.ObjectId;
      totalSpent: number;
    }>([
      {
        $match: {
          userId: budget.userId,
          type: 'expense',
          budgetItemId: { $exists: true },
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
        $match: {
          normalizedBudgetItemId: {
            $in: budgetItems.map((item) => item._id),
          },
        },
      },
      {
        $group: {
          _id: '$normalizedBudgetItemId',
          totalSpent: { $sum: { $abs: '$amount' } },
        },
      },
    ]);

    const spentMap = new Map<string, number>();
    for (const t of transactions) {
      spentMap.set(t._id.toString(), t.totalSpent);
    }

    return budgetItems.map((item) => ({
      ...item.toObject<BudgetItem & { _id: Types.ObjectId }>(),
      spent: this.roundCurrency(spentMap.get(item._id.toString()) || 0),
    }));
  }

  private roundCurrency(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }
}
