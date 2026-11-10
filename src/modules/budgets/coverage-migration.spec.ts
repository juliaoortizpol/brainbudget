import { Types } from 'mongoose';
import {
  budgetCoverage,
  completedDayCutoff,
  coversPurchase,
} from './budget-coverage';
import {
  migrateSyntheticCoverage,
  planCoverageMigration,
  CoverageMigrationDecision,
  LegacyCoverageRecord,
} from './coverage-migration';

describe('synthetic legacy coverage migration', () => {
  const owner = new Types.ObjectId();
  const id = new Types.ObjectId();
  const now = new Date('2025-02-01T00:00:00Z');
  const legacy: LegacyCoverageRecord = {
    _id: id,
    userId: owner,
    startDate: new Date('2024-11-01T04:00:00Z'),
    endDate: new Date('2024-11-30T04:00:00Z'),
    status: 'closed',
  };
  const decision: CoverageMigrationDecision = {
    budgetId: String(id),
    timezone: 'America/La_Paz',
    endInterpretation: 'preserve-inclusive-instant',
    closedAt: new Date('2024-12-01T04:00:00Z'),
  };
  it('preserves last-day-midnight exactly as an inclusive instant, never inventing a full last day', () => {
    const before = {
      ...legacy,
      _id: new Types.ObjectId(String(legacy._id)),
      userId: new Types.ObjectId(String(legacy.userId)),
      startDate: new Date(legacy.startDate),
      endDate: new Date(legacy.endDate!),
    };
    const plan = planCoverageMigration([legacy], [decision], [], now);
    expect(plan.applicable).toBe(true);
    expect(plan.changes[0].fields.actualCutoffDate).toEqual(
      new Date('2024-11-30T04:00:00.001Z'),
    );
    expect(plan.changes[0].fields.plannedEndDate).toEqual(legacy.endDate);
    expect(legacy).toEqual(before);
    const converted = { ...legacy, ...plan.changes[0].fields };
    expect(coversPurchase(budgetCoverage(converted), legacy.endDate!)).toBe(
      true,
    );
    expect(
      coversPurchase(
        budgetCoverage(converted),
        new Date('2024-11-30T04:00:00.001Z'),
      ),
    ).toBe(false);
    expect(
      planCoverageMigration([converted], [decision], [], now).changes,
    ).toEqual([]);
  });
  it('requires a deliberate timezone and closed-at decision; exposes ambiguity without writes', () => {
    expect(planCoverageMigration([legacy], [], [], now)).toMatchObject({
      applicable: false,
      changes: [],
    });
    for (const override of [
      { timezone: '' },
      { closedAt: undefined },
      {
        actualCutoffDate: new Date('2026-01-01'),
        endInterpretation: 'explicit-cutoff' as const,
      },
      { timezone: 'Invalid/Zone' },
    ]) {
      expect(
        planCoverageMigration([legacy], [{ ...decision, ...override }], [], now)
          .applicable,
      ).toBe(false);
    }
  });
  it('supports an explicit whole completed last-day cutoff only after a deliberate decision', () => {
    const cutoff = completedDayCutoff('2024-11-30', decision.timezone);
    const plan = planCoverageMigration(
      [legacy],
      [
        {
          ...decision,
          endInterpretation: 'explicit-cutoff',
          actualCutoffDate: cutoff,
        },
      ],
      [],
      now,
    );
    expect(plan.changes[0].fields.actualCutoffDate).toEqual(
      new Date('2024-12-01T04:00:00Z'),
    );
  });
  it('blocks affected saved associations, duplicate active and overlapping closed coverage', () => {
    expect(
      planCoverageMigration(
        [legacy],
        [decision],
        [
          {
            id: 'saved-transaction',
            budgetId: String(id),
            date: new Date('2024-11-30T12:00:00Z'),
          },
        ],
        now,
      ),
    ).toMatchObject({
      applicable: false,
      issues: [expect.stringContaining('saved-transaction')],
    });
    const nextId = new Types.ObjectId();
    const other = { ...legacy, _id: nextId };
    expect(
      planCoverageMigration(
        [legacy, other],
        [decision, { ...decision, budgetId: String(nextId) }],
        [],
        now,
      ).applicable,
    ).toBe(false);
    const active = { ...legacy, status: 'active' };
    const choices = [id, nextId].map((budgetId) => ({
      budgetId: String(budgetId),
      timezone: decision.timezone,
      endInterpretation: 'open-active' as const,
    }));
    expect(
      planCoverageMigration(
        [active, { ...active, _id: nextId }],
        choices,
        [],
        now,
      ).issues,
    ).toContainEqual(expect.stringContaining('multiple active'));
  });
  it('extends active coverage only after explicit acknowledgment and preserves IDs/associations', () => {
    const active = { ...legacy, status: 'active' };
    const assignments = [
      { id: 'existing', budgetId: String(id), date: new Date('2025-01-01') },
    ];
    const before = structuredClone(assignments);
    const plan = planCoverageMigration(
      [active],
      [
        {
          budgetId: String(id),
          timezone: decision.timezone,
          endInterpretation: 'open-active',
        },
      ],
      assignments,
      now,
    );
    expect(plan.applicable).toBe(true);
    expect(plan.changes[0].id).toBe(String(id));
    expect(Object.keys(plan.changes[0].fields).sort()).toEqual([
      'coverageVersion',
      'plannedEndDate',
      'timezone',
    ]);
    expect(assignments).toEqual(before);
  });
  it('rejects every database except the named synthetic database before accessing collections', async () => {
    const collection = jest.fn();
    await expect(
      migrateSyntheticCoverage(
        { name: 'not-authorized', collection } as never,
        String(owner),
        [],
      ),
    ).rejects.toThrow('brainbudget_qa_synthetic');
    expect(collection).not.toHaveBeenCalled();
  });
  it('converts DST, leap-day, year and fractional-offset calendar days to next local midnight', () => {
    for (const [day, zone, expected] of [
      ['2024-03-10', 'America/New_York', '2024-03-11T04:00:00.000Z'],
      ['2024-11-03', 'America/New_York', '2024-11-04T05:00:00.000Z'],
      ['2024-02-29', 'America/La_Paz', '2024-03-01T04:00:00.000Z'],
      ['2024-12-31', 'Asia/Kathmandu', '2024-12-31T18:15:00.000Z'],
    ])
      expect(completedDayCutoff(day, zone).toISOString()).toBe(expected);
  });
});
