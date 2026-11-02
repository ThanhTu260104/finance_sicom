import {
  buildOperatingCostPeriodWhere,
  resolveOperatingCostPeriodRange,
} from './operating-cost-period.util';

describe('operating-cost-period.util', () => {
  it('resolves year to full calendar range', () => {
    expect(resolveOperatingCostPeriodRange({ year: 2026 })).toEqual({
      fromPeriod: '2026-01',
      toPeriod: '2026-12',
    });
  });

  it('intersects year with explicit from/to', () => {
    expect(
      resolveOperatingCostPeriodRange({
        year: 2026,
        fromPeriod: '2025-06',
        toPeriod: '2026-03',
      }),
    ).toEqual({
      fromPeriod: '2026-01',
      toPeriod: '2026-03',
    });
  });

  it('prefers exact period over range', () => {
    expect(
      buildOperatingCostPeriodWhere({
        period: '2026-08',
        fromPeriod: '2026-01',
        toPeriod: '2026-12',
      }),
    ).toEqual({ period: '2026-08' });
  });
});
