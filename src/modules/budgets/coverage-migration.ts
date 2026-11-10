import { ClientSession, Connection, Types } from 'mongoose';
import {
  budgetCoverage,
  coverageOverlaps,
  coversPurchase,
  validateCoverage,
  validateFinalCutoff,
} from './budget-coverage';
import { coverageWrite } from './coverage-write';

export interface LegacyCoverageRecord {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  startDate: Date;
  endDate?: Date;
  status: string;
  isDeleted?: boolean;
  coverageVersion?: number;
  timezone?: string;
  actualCutoffDate?: Date;
  closedAt?: Date;
}
export interface CoverageMigrationDecision {
  budgetId: string;
  timezone: string;
  /** Explicit acknowledgment; do not infer intent from periodType/endDate. */
  endInterpretation:
    | 'preserve-inclusive-instant'
    | 'explicit-cutoff'
    | 'open-active'
    | 'draft';
  actualCutoffDate?: Date;
  closedAt?: Date;
}
export interface SavedCoverageAssignment {
  id: string;
  budgetId: string;
  date: Date;
}

/** Pure preview. No documents are mutated, and no timezone is inferred. */
export function planCoverageMigration(
  records: LegacyCoverageRecord[],
  decisions: CoverageMigrationDecision[],
  assignments: SavedCoverageAssignment[],
  now: Date,
) {
  const issues: string[] = [];
  const changes: { id: string; fields: Record<string, unknown> }[] = [];
  const candidates = records.map((record) => {
    if (record.isDeleted) return record;
    if (record.coverageVersion === 1) {
      try {
        validateCoverage(budgetCoverage(record));
        if (record.status === 'closed')
          validateFinalCutoff(budgetCoverage(record), record.closedAt!, now);
        else if (record.actualCutoffDate || record.closedAt)
          throw new Error('unclosed budget has finalized closure fields');
      } catch (error) {
        issues.push(`${String(record._id)}: ${(error as Error).message}`);
      }
      return record;
    }
    const selected = decisions.filter((d) => d.budgetId === String(record._id));
    const decision = selected[0];
    const id = String(record._id);
    if (selected.length !== 1) {
      issues.push(
        `${id}: exactly one explicit timezone/coverage decision is required`,
      );
      return record;
    }
    try {
      if (record.coverageVersion !== undefined)
        throw new Error('unknown coverage version');
      if (!record.endDate || !Number.isFinite(record.endDate.getTime()))
        throw new Error('valid legacy endDate required');
      if (
        !Number.isFinite(record.startDate.getTime()) ||
        record.endDate < record.startDate
      )
        throw new Error('invalid legacy fixed interval');
      if (
        record.status !== 'closed' &&
        (record.actualCutoffDate || record.closedAt)
      )
        throw new Error(
          'unclosed legacy record contains ambiguous closure fields',
        );
      let cutoff: Date | undefined;
      if (record.status === 'closed') {
        if (decision.endInterpretation === 'preserve-inclusive-instant')
          cutoff = new Date(record.endDate.getTime() + 1);
        else if (decision.endInterpretation === 'explicit-cutoff')
          cutoff = decision.actualCutoffDate;
        else
          throw new Error(
            'closed history requires an explicit end interpretation',
          );
        if (!cutoff || !decision.closedAt)
          throw new Error('closed cutoff and attested closedAt are required');
      } else if (record.status === 'active') {
        if (decision.endInterpretation !== 'open-active')
          throw new Error(
            'active extension requires explicit open-active acknowledgment',
          );
      } else if (
        record.status !== 'draft' ||
        decision.endInterpretation !== 'draft'
      )
        throw new Error('invalid legacy status or decision');
      if (
        record.status !== 'closed' &&
        (decision.actualCutoffDate || decision.closedAt)
      )
        throw new Error('unclosed budgets cannot have final closure fields');
      const candidate = {
        ...record,
        coverageVersion: 1,
        timezone: decision.timezone,
        actualCutoffDate: cutoff,
        closedAt: decision.closedAt,
      };
      validateCoverage(budgetCoverage(candidate));
      if (candidate.status === 'closed')
        validateFinalCutoff(
          budgetCoverage(candidate),
          candidate.closedAt!,
          now,
        );
      for (const assignment of assignments.filter((a) => a.budgetId === id))
        if (!coversPurchase(budgetCoverage(candidate), assignment.date))
          throw new Error(
            `saved assignment ${assignment.id} is outside proposed coverage; resolve explicitly`,
          );
      changes.push({
        id,
        fields: {
          coverageVersion: 1,
          timezone: decision.timezone,
          plannedEndDate: record.endDate,
          ...(cutoff
            ? { actualCutoffDate: cutoff, closedAt: decision.closedAt }
            : {}),
        },
      });
      return candidate;
    } catch (error) {
      issues.push(`${id}: ${(error as Error).message}`);
      return record;
    }
  });
  const live = candidates.filter((r) => !r.isDeleted && r.status !== 'draft');
  for (let i = 0; i < live.length; i++)
    for (const other of live.slice(i + 1)) {
      const record = live[i];
      if (String(record.userId) !== String(other.userId)) continue;
      if (record.status === 'active' && other.status === 'active')
        issues.push(
          `${String(record._id)}/${String(other._id)}: multiple active budgets require resolution`,
        );
      try {
        if (
          record.coverageVersion === 1 &&
          other.coverageVersion === 1 &&
          coverageOverlaps(budgetCoverage(record), budgetCoverage(other))
        )
          issues.push(
            `${String(record._id)}/${String(other._id)}: conflicting coverage requires resolution`,
          );
      } catch {
        issues.push(
          `${String(record._id)}/${String(other._id)}: invalid coverage requires resolution`,
        );
      }
    }
  return { issues, changes, applicable: issues.length === 0 };
}

/** Operator entry point: preview by default; only the synthetic database is allowed. */
export async function migrateSyntheticCoverage(
  connection: Connection,
  userId: string,
  decisions: CoverageMigrationDecision[],
  apply = false,
) {
  if (connection.name !== 'brainbudget_qa_synthetic')
    throw new Error(
      'Migration tooling is restricted to brainbudget_qa_synthetic',
    );
  const work = async (session?: ClientSession) => {
    const owner = new Types.ObjectId(userId);
    const budgets = (await connection
      .collection('budgets')
      .find({ userId: owner }, { session })
      .toArray()) as unknown as LegacyCoverageRecord[];
    const items = await connection
      .collection('budgetitems')
      .find({ userId: owner }, { session })
      .toArray();
    const itemBudgets = new Map(
      items.map((item) => [String(item._id), String(item.budgetId)]),
    );
    const transactions = await connection
      .collection('transactions')
      .find(
        {
          userId: owner,
          budgetItemId: {
            $in: items.flatMap((item) => [item._id, String(item._id)]),
          },
        },
        { session },
      )
      .toArray();
    const assignments = transactions.map((t) => ({
      id: String(t._id),
      budgetId: itemBudgets.get(String(t.budgetItemId))!,
      date: t.date as Date,
    }));
    const plan = planCoverageMigration(
      budgets,
      decisions,
      assignments,
      new Date(),
    );
    if (apply && plan.applicable)
      for (const change of plan.changes) {
        await connection.collection('budgets').updateOne(
          {
            _id: new Types.ObjectId(change.id),
            userId: owner,
            coverageVersion: { $ne: 1 },
          },
          { $set: change.fields },
          { session },
        );
      }
    return { ...plan, applied: apply && plan.applicable };
  };
  return apply ? coverageWrite(connection, userId, work) : work();
}
