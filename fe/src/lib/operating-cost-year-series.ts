import type { OperatingCostTrendPoint } from '@/lib/types';

/** Luôn 12 kỳ YYYY-01 … YYYY-12; tháng không có data = total "0". */
export function fillCalendarYearPoints(
  year: number | string,
  points: OperatingCostTrendPoint[],
): OperatingCostTrendPoint[] {
  const y = String(year).slice(0, 4);
  const byPeriod = new Map(points.map((p) => [p.period, p]));
  return Array.from({ length: 12 }, (_, i) => {
    const period = `${y}-${String(i + 1).padStart(2, '0')}`;
    return (
      byPeriod.get(period) ?? {
        period,
        total: '0',
        byCategory: [],
      }
    );
  });
}

export function parseYearFromPeriod(period: string): number {
  const y = Number(period.slice(0, 4));
  return Number.isFinite(y) ? y : new Date().getFullYear();
}
