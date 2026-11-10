import {
  BudgetCoverage,
  completedDayCutoff,
  coverageDateFilter,
  coverageOverlaps,
  coversPurchase,
  isLocalMidnight,
  validateCoverage,
  validateFinalCutoff,
} from './budget-coverage';

const date = (value: string) => new Date(value);
const active: BudgetCoverage = {
  startDate: date('2024-11-01T04:00:00Z'),
  timezone: 'America/La_Paz',
};

describe('purchase-date coverage foundation', () => {
  it('converts completed local days across DST, year and leap boundaries', () => {
    expect(completedDayCutoff('2024-03-10', 'America/New_York')).toEqual(
      date('2024-03-11T04:00:00Z'),
    );
    expect(completedDayCutoff('2024-11-03', 'America/New_York')).toEqual(
      date('2024-11-04T05:00:00Z'),
    );
    expect(completedDayCutoff('2024-12-31', 'America/La_Paz')).toEqual(
      date('2025-01-01T04:00:00Z'),
    );
    expect(completedDayCutoff('2024-02-29', 'Asia/Kathmandu')).toEqual(
      date('2024-02-29T18:15:00Z'),
    );
    expect(() => completedDayCutoff('2023-02-29', 'UTC')).toThrow();
    expect(() => completedDayCutoff('2011-12-29', 'Pacific/Apia')).toThrow();
  });
  it('keeps an open interval across planned month and year boundaries', () => {
    expect(coversPurchase(active, date('2024-11-01T03:59:59.999Z'))).toBe(
      false,
    );
    expect(coversPurchase(active, active.startDate)).toBe(true);
    expect(coversPurchase(active, date('2024-12-15T12:00:00Z'))).toBe(true);
    expect(coversPurchase(active, date('2026-01-01T04:00:00Z'))).toBe(true);
    expect(coverageDateFilter(active)).toEqual({ $gte: active.startDate });
  });

  it('uses the same exclusive cutoff in memory and persisted query predicates', () => {
    const cutoff = date('2025-01-01T04:00:00Z');
    const closed = { ...active, actualCutoffDate: cutoff };
    expect(coversPurchase(closed, date('2025-01-01T03:59:59.999Z'))).toBe(true);
    expect(coversPurchase(closed, cutoff)).toBe(false);
    expect(coverageDateFilter(closed)).toEqual({
      $gte: active.startDate,
      $lt: cutoff,
    });
    expect(coverageOverlaps(closed, { ...active, startDate: cutoff })).toBe(
      false,
    );
    expect(coverageOverlaps(closed, active)).toBe(true);
    expect(coverageOverlaps(active, closed)).toBe(true);
  });

  it('includes the leap day without a fixed month length assumption', () => {
    const leap = {
      startDate: date('2024-02-01T04:00:00Z'),
      actualCutoffDate: date('2024-03-01T04:00:00Z'),
      timezone: active.timezone,
    };
    expect(coversPurchase(leap, date('2024-03-01T03:59:59.999Z'))).toBe(true);
    expect(coversPurchase(leap, leap.actualCutoffDate)).toBe(false);
  });

  it('checks local midnight across daylight saving and non-hour offsets', () => {
    expect(
      isLocalMidnight(date('2024-03-10T05:00:00Z'), 'America/New_York'),
    ).toBe(true);
    expect(
      isLocalMidnight(date('2024-03-11T04:00:00Z'), 'America/New_York'),
    ).toBe(true);
    expect(
      isLocalMidnight(date('2024-03-11T05:00:00Z'), 'America/New_York'),
    ).toBe(false);
    expect(
      isLocalMidnight(date('2024-01-01T18:15:00Z'), 'Asia/Kathmandu'),
    ).toBe(true);
    expect(
      isLocalMidnight(date('2024-11-01T04:00:00.001Z'), active.timezone),
    ).toBe(false);
  });

  it('rejects invalid zones, invalid instants and empty or reversed coverage', () => {
    expect(() =>
      validateCoverage({ ...active, timezone: 'invalid/zone' }),
    ).toThrow();
    expect(() => validateCoverage({ ...active, timezone: '' })).toThrow();
    expect(() =>
      validateCoverage({ ...active, startDate: new Date(NaN) }),
    ).toThrow();
    expect(() => coversPurchase(active, new Date(NaN))).toThrow();
    for (const cutoff of ['2024-11-01T04:00:00Z', '2024-10-31T04:00:00Z']) {
      expect(() =>
        validateCoverage({ ...active, actualCutoffDate: date(cutoff) }),
      ).toThrow();
    }
  });

  it('preserves arbitrary explicit start and closing instants without rounding', () => {
    const coverage = {
      ...active,
      startDate: date('2024-11-01T12:34:56.789Z'),
      actualCutoffDate: date('2024-12-03T17:21:42.123Z'),
    };
    expect(() =>
      validateFinalCutoff(
        coverage,
        coverage.actualCutoffDate,
        coverage.actualCutoffDate,
      ),
    ).not.toThrow();
    expect(coversPurchase(coverage, date('2024-12-03T17:21:42.122Z'))).toBe(
      true,
    );
    expect(coversPurchase(coverage, coverage.actualCutoffDate)).toBe(false);
    expect(coversPurchase(coverage, coverage.startDate)).toBe(true);
  });

  it('requires a final cutoff no later than closure and a nonfuture closed-at timestamp', () => {
    const closed = {
      ...active,
      actualCutoffDate: date('2024-12-01T04:00:00Z'),
    };
    const now = date('2024-12-02T12:00:00Z');
    expect(() => validateFinalCutoff(closed, now, now)).not.toThrow();
    expect(() => validateFinalCutoff(active, now, now)).toThrow();
    expect(() =>
      validateFinalCutoff(closed, date('2024-11-30T12:00:00Z'), now),
    ).toThrow();
    expect(() =>
      validateFinalCutoff(closed, date('2024-12-03T12:00:00Z'), now),
    ).toThrow();
    expect(() => validateFinalCutoff(closed, new Date(NaN), now)).toThrow();
  });
});
