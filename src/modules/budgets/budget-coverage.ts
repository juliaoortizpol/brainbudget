/** Purchase-date coverage. Planned dates deliberately do not participate. */
export interface BudgetCoverage {
  startDate: Date;
  actualCutoffDate?: Date;
  timezone: string;
}

/** Legacy reads preserve the old inclusive end instant until explicit migration. */
export function budgetCoverage(budget: {
  startDate: Date;
  endDate?: Date;
  actualCutoffDate?: Date;
  timezone?: string;
  coverageVersion?: number;
}): BudgetCoverage {
  if (budget.coverageVersion === 1) {
    if (!budget.timezone) throw new Error('Budget timezone is required');
    return {
      startDate: budget.startDate,
      actualCutoffDate: budget.actualCutoffDate,
      timezone: budget.timezone,
    };
  }
  if (!budget.endDate)
    throw new Error('Legacy budget requires explicit migration');
  return {
    startDate: budget.startDate,
    actualCutoffDate: new Date(budget.endDate.getTime() + 1),
    // UTC here only validates instants. It is never saved as historical timezone.
    timezone: 'UTC',
  };
}

function timestamp(date: Date): number {
  if (!(date instanceof Date) || !Number.isFinite(date.getTime())) {
    throw new Error('Coverage boundaries must be valid instants');
  }
  return date.getTime();
}

/** Validate the instant in the preserved budget timezone, never the host zone. */
export function isLocalMidnight(date: Date, timezone: string): boolean {
  timestamp(date);
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hourCycle: 'h23',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date);
  return (
    date.getUTCMilliseconds() === 0 &&
    ['hour', 'minute', 'second'].every(
      (type) => parts.find((part) => part.type === type)?.value === '00',
    )
  );
}

/** End of a completed local day, represented by the next local midnight. */
export function completedDayCutoff(day: string, timezone: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day))
    throw new Error('Completed day must be YYYY-MM-DD');
  const parsed = new Date(`${day}T00:00:00.000Z`);
  if (
    !Number.isFinite(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== day
  )
    throw new Error('Invalid completed calendar day');
  const target = new Date(parsed.getTime() + 86400000);
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  let instant = target.getTime();
  for (let i = 0; i < 5; i++) {
    const parts = formatter.formatToParts(new Date(instant));
    const value = (type: string) =>
      Number(parts.find((p) => p.type === type)?.value);
    const local = Date.UTC(
      value('year'),
      value('month') - 1,
      value('day'),
      value('hour'),
      value('minute'),
      value('second'),
    );
    if (local === target.getTime()) return new Date(instant);
    instant += target.getTime() - local;
  }
  throw new Error(
    'Next local midnight is unavailable; provide an explicit cutoff instant',
  );
}

export function validateCoverage(coverage: BudgetCoverage): void {
  timestamp(coverage.startDate);
  if (!coverage.timezone) throw new Error('Budget timezone is required');
  new Intl.DateTimeFormat('en-GB', { timeZone: coverage.timezone });
  if (coverage.actualCutoffDate !== undefined) {
    if (timestamp(coverage.actualCutoffDate) <= timestamp(coverage.startDate)) {
      throw new Error(
        'Actual cutoff must be a valid instant after coverage start',
      );
    }
  }
}

export function validateFinalCutoff(
  coverage: BudgetCoverage,
  closedAt: Date,
  now: Date,
): void {
  validateCoverage(coverage);
  if (
    !coverage.actualCutoffDate ||
    timestamp(coverage.actualCutoffDate) > timestamp(closedAt) ||
    timestamp(closedAt) > timestamp(now)
  ) {
    throw new Error(
      'Final cutoff and closure timestamp must not be in the future',
    );
  }
}

export function coverageDateFilter(coverage: BudgetCoverage): {
  $gte: Date;
  $lt?: Date;
} {
  validateCoverage(coverage);
  return {
    $gte: coverage.startDate,
    ...(coverage.actualCutoffDate ? { $lt: coverage.actualCutoffDate } : {}),
  };
}

export function coversPurchase(
  coverage: BudgetCoverage,
  purchaseDate: Date,
): boolean {
  const range = coverageDateFilter(coverage);
  const purchase = timestamp(purchaseDate);
  return (
    purchase >= range.$gte.getTime() &&
    (!range.$lt || purchase < range.$lt.getTime())
  );
}

/** Invalid legacy intervals are ineligible, never extended or repaired on read. */
export function budgetCoversPurchase(
  budget: Parameters<typeof budgetCoverage>[0],
  purchaseDate: Date,
): boolean {
  try {
    return coversPurchase(budgetCoverage(budget), purchaseDate);
  } catch {
    return false;
  }
}

export function coverageOverlaps(
  a: BudgetCoverage,
  b: BudgetCoverage,
): boolean {
  validateCoverage(a);
  validateCoverage(b);
  return (
    a.startDate.getTime() < (b.actualCutoffDate?.getTime() ?? Infinity) &&
    b.startDate.getTime() < (a.actualCutoffDate?.getTime() ?? Infinity)
  );
}
