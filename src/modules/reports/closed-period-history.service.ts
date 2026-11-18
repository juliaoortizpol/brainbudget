import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model, Types } from 'mongoose';
import type { Transaction } from '../transactions/schemas/transaction.schema';
import { BudgetPeriodReport } from './schemas/budget-period-report.schema';
import { transactionEvidence } from './transaction-evidence';
import { ClosedPeriodException } from './schemas/closed-period-exception.schema';

type ReportLink = Pick<
  BudgetPeriodReport,
  'budgetId' | 'startDate' | 'actualCutoffDate' | 'includedTransactionIds'
> & { _id: Types.ObjectId };

function covers(report: ReportLink, date: Date) {
  return (
    report.actualCutoffDate !== undefined &&
    report.startDate <= date &&
    date < report.actualCutoffDate
  );
}

@Injectable()
export class ClosedPeriodHistoryService {
  constructor(
    @InjectModel(BudgetPeriodReport.name)
    private readonly reports: Model<BudgetPeriodReport>,
    @InjectModel(ClosedPeriodException.name)
    private readonly exceptions: Model<ClosedPeriodException>,
  ) {}

  // Call after taking the coverage lock, using the same session as the write.
  async links(
    userId: Types.ObjectId,
    dates: Date[],
    session: ClientSession,
    transactionId?: Types.ObjectId,
  ): Promise<ReportLink[]> {
    const previous = transactionId
      ? await this.exceptions
          .distinct('reportId', { userId, transactionId })
          .session(session)
          .exec()
      : [];
    return this.reports
      .find(
        {
          userId,
          snapshotVersion: 1,
          $or: [
            ...dates.map((date) => ({
              startDate: { $lte: date },
              actualCutoffDate: { $gt: date },
            })),
            ...(transactionId
              ? [
                  { includedTransactionIds: transactionId.toString() },
                  { _id: { $in: previous } },
                ]
              : []),
          ],
        },
        {
          budgetId: 1,
          startDate: 1,
          actualCutoffDate: 1,
          ...(transactionId ? { includedTransactionIds: 1 } : {}),
        },
        { session },
      )
      .lean<ReportLink[]>()
      .exec();
  }

  isCovered(links: ReportLink[], date: Date) {
    return links.some((report) => covers(report, date));
  }

  async record(
    userId: Types.ObjectId,
    transactionId: Types.ObjectId,
    links: ReportLink[],
    before: Transaction | null,
    after: Transaction,
    session: ClientSession,
  ) {
    if (!links.length) return;
    const previous = before && transactionEvidence(transactionId, before);
    const current = transactionEvidence(transactionId, after);
    if (JSON.stringify(previous) === JSON.stringify(current)) return;

    for (const report of links) {
      const inCoverageAfter = covers(report, after.date);
      if (!before && !inCoverageAfter) continue;
      await new this.exceptions({
        userId,
        transactionId,
        reportId: report._id,
        budgetId: report.budgetId,
        kind: before ? 'correction' : 'late_arrival',
        includedInSnapshot:
          report.includedTransactionIds?.includes(transactionId.toString()) ??
          false,
        inCoverageAfter,
        before: previous,
        after: current,
      }).save({ session });
    }
  }

  async protectDeletion(
    userId: Types.ObjectId,
    transactionId: Types.ObjectId,
    session: ClientSession,
  ) {
    const links = await this.links(userId, [], session, transactionId);
    if (links.length)
      throw new ConflictException({
        code: 'closed_period_transaction_retained',
        message:
          'This transaction is retained as final report evidence. Use a live correction to resolve errors.',
      });
  }

  async transactionIdsWithExceptions(
    userId: Types.ObjectId,
    transactionIds: Types.ObjectId[],
  ) {
    if (!transactionIds.length) return new Set<string>();
    const ids = await this.exceptions
      .distinct('transactionId', {
        userId,
        transactionId: { $in: transactionIds },
      })
      .exec();
    return new Set(ids.map((id) => id.toString()));
  }

  async listForReport(
    owner: string,
    reportId: string,
    page: number,
    limit: number,
  ) {
    if (!Types.ObjectId.isValid(reportId))
      throw new NotFoundException('Final report not found');
    const userId = new Types.ObjectId(owner);
    const _id = new Types.ObjectId(reportId);
    if (
      !(await this.reports.exists({ _id, userId, snapshotVersion: 1 }).exec())
    )
      throw new NotFoundException('Final report not found');
    return this.list({ userId, reportId: _id }, page, limit);
  }

  listForTransaction(
    owner: string,
    transactionId: Types.ObjectId,
    page: number,
    limit: number,
  ) {
    return this.list(
      { userId: new Types.ObjectId(owner), transactionId },
      page,
      limit,
    );
  }

  private async list(
    filter: {
      userId: Types.ObjectId;
      reportId?: Types.ObjectId;
      transactionId?: Types.ObjectId;
    },
    page: number,
    limit: number,
  ) {
    const [data, total] = await Promise.all([
      this.exceptions
        .find(filter, { userId: 0 })
        .sort({ _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean()
        .exec(),
      this.exceptions.countDocuments(filter).exec(),
    ]);
    return { data, page, limit, total };
  }
}
