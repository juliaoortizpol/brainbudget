/** Purchase-date coverage. Planned dates deliberately do not participate. */
export interface BudgetCoverage {
  startDate: Date;
  actualCutoffDate?: Date;
  timezone: string;
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

export function validateCoverage(coverage: BudgetCoverage): void {
  if (
    !coverage.timezone ||
    !isLocalMidnight(coverage.startDate, coverage.timezone)
  ) {
    throw new Error(
      'Coverage start must be local midnight in the budget timezone',
    );
  }
  if (coverage.actualCutoffDate !== undefined) {
    if (
      !isLocalMidnight(coverage.actualCutoffDate, coverage.timezone) ||
      timestamp(coverage.actualCutoffDate) <= timestamp(coverage.startDate)
    ) {
      throw new Error(
        'Actual cutoff must be local midnight after coverage start',
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
