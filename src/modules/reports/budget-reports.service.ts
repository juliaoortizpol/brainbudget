import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { createHash } from 'node:crypto';
import { ClientSession, Model, Types } from 'mongoose';
import {
  budgetCoverage,
  completedDayCutoff,
  coverageDateFilter,
  coverageOverlaps,
  validateCoverage,
  validateFinalCutoff,
} from '../budgets/budget-coverage';
import { coverageWrite } from '../budgets/coverage-write';
import {
  currencyIssue,
  supportedBudgetCurrency,
} from '../budgets/currency-policy';
import { BudgetItem } from '../budgets/schemas/budget-item.schema';
import { Budget } from '../budgets/schemas/budget.schema';
import { Transaction } from '../transactions/schemas/transaction.schema';
import { ClosePreviewDto, ConfirmCloseDto } from './close-budget.dto';
import {
  BudgetPeriodReport,
  SavedReportTransaction,
} from './schemas/budget-period-report.schema';

function id(value: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(value)) throw new NotFoundException();
  return new Types.ObjectId(value);
}

function round(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

@Injectable()
export class BudgetReportsService {
  constructor(
    @InjectModel(Budget.name) private readonly budgets: Model<Budget>,
    @InjectModel(BudgetItem.name) private readonly items: Model<BudgetItem>,
    @InjectModel(Transaction.name)
    private readonly transactions: Model<Transaction>,
    @InjectModel(BudgetPeriodReport.name)
    private readonly reports: Model<BudgetPeriodReport>,
  ) {}

  async preview(budgetId: string, owner: string, dto: ClosePreviewDto) {
    return this.buildPreview(budgetId, owner, dto);
  }

  private async buildPreview(
    budgetId: string,
    owner: string,
    dto: ClosePreviewDto,
    session?: ClientSession,
  ) {
    const userId = id(owner);
    const budget = await this.budgets
      .findOne({ _id: id(budgetId), userId, isDeleted: false }, null, {
        session,
      })
      .lean()
      .exec();
    if (!budget) throw new NotFoundException('Budget not found');
    if (budget.status !== 'active')
      throw new ConflictException(
        'Only an active budget can be previewed for closing',
      );

    const now = new Date();
    let timezone: string | undefined;
    if (budget.timezone) {
      try {
        new Intl.DateTimeFormat('en-GB', { timeZone: budget.timezone });
        timezone = budget.timezone;
      } catch {
        // Keep review available for explicit instants when saved context is invalid.
      }
    }
    if (
      dto.closeThroughDate !== undefined &&
      dto.actualCutoffDate !== undefined
    )
      throw new BadRequestException(
        'Choose an explicit cutoff or completed day, not both',
      );
    let cutoff: Date;
    try {
      if (dto.closeThroughDate !== undefined && !timezone)
        throw new Error(
          'Resolve budget timezone or use an explicit cutoff to review purchases',
        );
      cutoff =
        dto.closeThroughDate !== undefined
          ? completedDayCutoff(dto.closeThroughDate, timezone!)
          : dto.actualCutoffDate !== undefined
            ? new Date(dto.actualCutoffDate)
            : now;
      validateFinalCutoff(
        {
          startDate: budget.startDate,
          actualCutoffDate: cutoff,
          timezone: timezone ?? 'UTC',
        },
        now,
        now,
      );
    } catch (error) {
      throw new BadRequestException((error as Error).message);
    }

    const blockers: {
      code: string;
      transactionId?: string;
      budgetItemId?: string | null;
      currency?: string | null;
    }[] = [];
    if (
      budget.coverageVersion !== 1 ||
      !timezone ||
      budget.actualCutoffDate ||
      budget.closedAt
    )
      blockers.push({ code: 'resolve_budget_lifecycle' });
    if (!supportedBudgetCurrency(budget.currencyContext))
      blockers.push({ code: 'resolve_planning_currency' });

    const otherBudgets = await this.budgets
      .find(
        {
          _id: { $ne: budget._id },
          userId,
          isDeleted: false,
          status: { $in: ['active', 'closed'] },
        },
        null,
        { session },
      )
      .sort({ _id: 1 })
      .lean()
      .exec();
    const dates = { startDate: budget.startDate, actualCutoffDate: cutoff };
    for (const other of otherBudgets) {
      try {
        if (other.coverageVersion !== 1)
          throw new Error('Unresolved lifecycle');
        const otherCoverage = budgetCoverage(other);
        if (other.status === 'closed') {
          if (!other.closedAt) throw new Error('Unresolved closure');
          validateFinalCutoff(otherCoverage, other.closedAt, now);
        } else {
          validateCoverage(otherCoverage);
        }
        if (
          other.status === 'active' ||
          coverageOverlaps(
            { ...dates, timezone: timezone ?? 'UTC' },
            otherCoverage,
          )
        )
          blockers.push({ code: 'conflicting_budget_coverage' });
      } catch {
        blockers.push({ code: 'resolve_other_budget_lifecycle' });
      }
    }

    const retainedItems = await this.items
      .find({ userId, budgetId: budget._id }, null, { session })
      .sort({ _id: 1 })
      .lean()
      .exec();
    const liveItems = retainedItems.filter((item) => item.isDeleted === false);
    const byId = new Map(liveItems.map((item) => [item._id.toString(), item]));
    const range = coverageDateFilter({
      ...dates,
      timezone: timezone ?? 'UTC',
    });
    const references = retainedItems.map((item) => item._id.toString());
    const rows = await this.transactions
      .find(
        {
          userId,
          $or: [
            { date: range },
            {
              $expr: {
                $in: [
                  {
                    $toLower: {
                      $convert: {
                        input: '$budgetItemId',
                        to: 'string',
                        onError: '',
                        onNull: '',
                      },
                    },
                  },
                  references,
                ],
              },
            },
          ],
        },
        null,
        { session },
      )
      .sort({ _id: 1 })
      .lean()
      .exec();

    const sums = new Map<string, number>();
    const transactions: SavedReportTransaction[] = [];
    for (const row of rows) {
      const transactionId = row._id.toString();
      const budgetItemId = row.budgetItemId?.toString().toLowerCase() ?? null;
      const evidence = { transactionId, budgetItemId };
      if (!(row.date >= budget.startDate && row.date < cutoff)) {
        blockers.push({ ...evidence, code: 'assignment_outside_cutoff' });
        continue;
      }
      const code = currencyIssue(row.currency);
      if (code)
        blockers.push({ ...evidence, code, currency: row.currency ?? null });
      const validAmount = Number.isFinite(row.amount);
      if (!validAmount)
        blockers.push({ ...evidence, code: 'invalid_purchase_amount' });
      const item = budgetItemId ? byId.get(budgetItemId) : undefined;
      if (!item)
        blockers.push({
          ...evidence,
          code: budgetItemId ? 'invalid_assignment' : 'unassigned',
        });
      else if (
        item.type !== row.type ||
        !['expense', 'income'].includes(row.type)
      )
        blockers.push({ ...evidence, code: 'assignment_type_conflict' });
      else if (!code && validAmount)
        sums.set(
          budgetItemId!,
          (sums.get(budgetItemId!) ?? 0) +
            (row.type === 'expense' ? Math.abs(row.amount) : row.amount),
        );

      transactions.push({
        ...evidence,
        date: row.date,
        name: row.name,
        amount: row.amount,
        type: row.type,
        currency: row.currency ?? null,
        currencyContextVersion: row.currencyContextVersion,
        currencyOrigin: row.currencyOrigin,
        accountId: row.accountId?.toString(),
        source: row.source,
        sourceMessageId: row.sourceMessageId,
        parserKey: row.parserKey,
        parserVersion: row.parserVersion,
        matchingStatus: row.matchingStatus,
        matchingSource: row.matchingSource,
        matchingConfidence: row.matchingConfidence,
        rawDescription: row.rawDescription,
        normalizedMerchant: row.normalizedMerchant,
        relationCode: row.relationCode,
        notes: row.notes,
      });
    }

    const items = liveItems.map((item) => {
      const actualAmount = round(sums.get(item._id.toString()) ?? 0);
      const plannedAmount = round(item.plannedAmount);
      if (
        !Number.isFinite(actualAmount) ||
        !Number.isFinite(plannedAmount) ||
        !['expense', 'income'].includes(item.type)
      )
        blockers.push({
          code: 'invalid_item_amount_or_type',
          budgetItemId: item._id.toString(),
        });
      return {
        budgetItemId: item._id.toString(),
        categoryName: item.name,
        type: item.type,
        description: item.description,
        icon: item.icon,
        color: item.color,
        alertEnabled: item.alertEnabled,
        matchingRules: item.matchingRules ?? [],
        configuredPlannedAmount: item.plannedAmount,
        plannedAmount,
        actualAmount,
        variance: round(
          item.type === 'expense'
            ? plannedAmount - actualAmount
            : actualAmount - plannedAmount,
        ),
      };
    });
    const totals = {
      totalPlanned: round(
        items.reduce((sum, item) => sum + item.plannedAmount, 0),
      ),
      totalActualIncome: round(
        items.reduce(
          (sum, item) => sum + (item.type === 'income' ? item.actualAmount : 0),
          0,
        ),
      ),
      totalActualExpense: round(
        items.reduce(
          (sum, item) =>
            sum + (item.type === 'expense' ? item.actualAmount : 0),
          0,
        ),
      ),
      totalVariance: round(items.reduce((sum, item) => sum + item.variance, 0)),
    };
    if (!Object.values(totals).every(Number.isFinite))
      blockers.push({ code: 'invalid_report_totals' });
    const detail = {
      snapshotVersion: 1,
      budgetId: budget._id,
      budgetName: budget.name,
      periodType: budget.periodType,
      ...dates,
      endDate: cutoff,
      timezone: budget.timezone,
      plannedEndDate: budget.plannedEndDate ?? budget.endDate ?? null,
      actualsCurrency: 'DOP',
      planningCurrencyContext: budget.currencyContext,
      items,
      totals,
      transactions,
      includedTransactionIds: transactions.map(
        ({ transactionId }) => transactionId,
      ),
      blockers,
    };
    const previewToken = createHash('sha256')
      .update(JSON.stringify({ owner: userId.toString(), ...detail }))
      .digest('hex');
    return { ...detail, previewToken };
  }

  async confirm(budgetId: string, owner: string, dto: ConfirmCloseDto) {
    if (dto.confirmed !== true)
      throw new BadRequestException('Explicit close confirmation is required');
    const filter = { budgetId: id(budgetId), userId: id(owner) };
    return coverageWrite(this.budgets.db, owner, async (session) => {
      const prior = await this.reports
        .findOne({ ...filter, snapshotVersion: 1 }, null, { session })
        .lean()
        .exec();
      if (prior)
        return {
          reportId: prior._id,
          budgetId: prior.budgetId,
          closedAt: prior.closedAt,
        };
      const preview = await this.buildPreview(
        budgetId,
        owner,
        { actualCutoffDate: dto.actualCutoffDate },
        session,
      );
      if (preview.previewToken !== dto.previewToken)
        throw new ConflictException({
          code: 'stale_close_preview',
          message:
            'Coverage or source evidence changed. Request and review a new preview',
          blockers: preview.blockers,
        });
      if (preview.blockers.length)
        throw new BadRequestException({
          code: 'close_blocked',
          message: 'Resolve preview blockers before closing',
          blockers: preview.blockers,
        });
      const closedAt = new Date();
      const report = await new this.reports({
        ...preview,
        userId: filter.userId,
        closedAt,
        currencyContext: {
          planning: preview.planningCurrencyContext,
          version: 1,
          actualsCurrency: 'DOP',
          complete: true,
          unresolvedTransactionIds: [],
          transactions: preview.transactions.map((row) => ({
            transactionId: row.transactionId,
            budgetItemId: row.budgetItemId,
            currency: row.currency,
            version: 1,
            origin: row.currencyOrigin ?? 'legacy-explicit',
          })),
        },
      }).save({ session });
      const result = await this.budgets
        .updateOne(
          {
            _id: filter.budgetId,
            userId: filter.userId,
            isDeleted: false,
            status: 'active',
          },
          {
            $set: {
              status: 'closed',
              closedAt,
              actualCutoffDate: preview.actualCutoffDate,
            },
          },
          { session, runValidators: true },
        )
        .exec();
      if (result.matchedCount !== 1)
        throw new ConflictException('Budget changed. Request a new preview');
      return {
        reportId: report._id,
        budgetId: report.budgetId,
        closedAt: report.closedAt,
      };
    });
  }

  async history(owner: string, page: number, limit: number) {
    const userId = id(owner);
    const filter = { userId, isDeleted: false, status: 'closed' };
    const budgets = await this.budgets
      .find(filter, {
        name: 1,
        periodType: 1,
        startDate: 1,
        plannedEndDate: 1,
        actualCutoffDate: 1,
        timezone: 1,
        closedAt: 1,
      })
      .sort({ closedAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean()
      .exec();
    const reports = await this.reports
      .find(
        {
          userId,
          budgetId: { $in: budgets.map((budget) => budget._id) },
          snapshotVersion: 1,
        },
        { budgetId: 1, totals: 1 },
      )
      .lean()
      .exec();
    const byBudget = new Map(
      reports.map((report) => [report.budgetId.toString(), report]),
    );
    const total = await this.budgets.countDocuments(filter).exec();
    return {
      page,
      limit,
      total,
      data: budgets.map((budget) => {
        const report = byBudget.get(budget._id.toString());
        return {
          ...budget,
          reportStatus: report ? 'final' : 'unavailable',
          reportId: report?._id ?? null,
          totals: report?.totals ?? null,
        };
      }),
    };
  }

  async detail(owner: string, reportId: string) {
    const report = await this.reports
      .findOne(
        {
          _id: id(reportId),
          userId: id(owner),
          snapshotVersion: 1,
        },
        { userId: 0 },
      )
      .lean()
      .exec();
    if (!report) throw new NotFoundException('Final report not found');
    return report;
  }

  async transaction(owner: string, reportId: string, transactionId: string) {
    const report = await this.detail(owner, reportId);
    const transaction = report.transactions?.find(
      (row) => row.transactionId === transactionId,
    );
    if (!transaction)
      throw new NotFoundException('Saved transaction not found');
    return transaction;
  }
}
