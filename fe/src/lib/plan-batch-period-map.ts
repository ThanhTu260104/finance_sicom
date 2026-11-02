import type { BillingCycle } from '@/lib/types';
import { formatDate } from '@/lib/format';

export type BatchPeriodSource = {
  period: string;
  batchSequence?: number | null;
  periodStartDate?: string | null;
  periodEndDate?: string | null;
};

export type PeriodBatchDecoration = {
  batchSequence: number;
  bandIndex: number;
  periodStartDate: string | null;
  periodEndDate: string | null;
};

export const BATCH_BAND_BG_CLASS = [
  'bg-violet-50/90',
  'bg-sky-50/90',
  'bg-emerald-50/90',
  'bg-amber-50/90',
  'bg-rose-50/90',
] as const;

export const BATCH_BAND_SVG_FILL = [
  '#f5f3ff',
  '#f0f9ff',
  '#ecfdf5',
  '#fffbeb',
  '#fff1f2',
] as const;

function billingIntervalMonths(cycle: BillingCycle | undefined): number {
  switch (cycle) {
    case 'MONTHLY':
      return 1;
    case 'BIMONTHLY':
      return 2;
    case 'QUARTERLY':
      return 3;
    case 'SEMI_ANNUALLY':
      return 6;
    case 'ANNUALLY':
      return 12;
    default:
      return 1;
  }
}

export function batchLabel(batchSequence: number | null | undefined): string | null {
  if (batchSequence == null || batchSequence <= 0) return null;
  return `Đợt ${batchSequence}`;
}

export function formatBatchDateRange(
  start: string | null | undefined,
  end: string | null | undefined,
): string | null {
  if (!start && !end) return null;
  if (start && end) {
    return `${formatDate(start)} → ${formatDate(end)}`;
  }
  return formatDate(start ?? end ?? null);
}

/** Gán màu đợt ổn định theo thứ tự batchSequence trên HĐ. */
export function buildPeriodBatchDecorations(
  periods: string[],
  rows: BatchPeriodSource[],
  billingCycle?: BillingCycle,
): Map<string, PeriodBatchDecoration> {
  const byPeriod = new Map(rows.map((r) => [r.period, r]));
  const batchOrder: number[] = [];
  const seen = new Set<number>();

  for (const row of rows) {
    const seq = row.batchSequence;
    if (seq != null && seq > 0 && !seen.has(seq)) {
      seen.add(seq);
      batchOrder.push(seq);
    }
  }
  batchOrder.sort((a, b) => a - b);
  const bandByBatch = new Map(batchOrder.map((seq, i) => [seq, i]));

  const periodKeys = Array.from(
    new Set([...periods, ...rows.map((r) => r.period)]),
  ).sort();

  const map = new Map<string, PeriodBatchDecoration>();
  for (const period of periodKeys) {
    const row = byPeriod.get(period);
    if (!row) continue;
    const seq = row.batchSequence;
    if (seq == null || seq <= 0) continue;
    map.set(period, {
      batchSequence: seq,
      bandIndex: bandByBatch.get(seq) ?? 0,
      periodStartDate: row.periodStartDate ?? null,
      periodEndDate: row.periodEndDate ?? null,
    });
  }
  return map;
}

export function isMultiMonthAcceptanceCycle(
  billingCycle: BillingCycle | undefined,
  decorations: Map<string, PeriodBatchDecoration>,
  periods: string[],
): boolean {
  if (billingIntervalMonths(billingCycle) > 1) return true;
  const byBatch = new Map<number, string[]>();
  for (const period of periods) {
    const d = decorations.get(period);
    if (!d) continue;
    const list = byBatch.get(d.batchSequence) ?? [];
    list.push(period);
    byBatch.set(d.batchSequence, list);
  }
  for (const list of byBatch.values()) {
    if (list.length > 1) return true;
  }
  return false;
}

export type BatchTimelineGroup = {
  batchSequence: number;
  bandIndex: number;
  periods: string[];
  periodStartDate: string | null;
  periodEndDate: string | null;
};

export function groupPeriodsByBatch(
  periods: string[],
  decorations: Map<string, PeriodBatchDecoration>,
): BatchTimelineGroup[] {
  const groups: BatchTimelineGroup[] = [];
  let current: BatchTimelineGroup | null = null;

  for (const period of periods) {
    const d = decorations.get(period);
    const seq = d?.batchSequence ?? null;
    if (seq == null) {
      if (current) {
        groups.push(current);
        current = null;
      }
      groups.push({
        batchSequence: -1,
        bandIndex: 0,
        periods: [period],
        periodStartDate: null,
        periodEndDate: null,
      });
      continue;
    }

    if (
      current &&
      current.batchSequence === seq &&
      current.periods[current.periods.length - 1] <
        period
    ) {
      current.periods.push(period);
      continue;
    }

    if (current) groups.push(current);
    if (!d) continue;
    current = {
      batchSequence: seq,
      bandIndex: d.bandIndex,
      periods: [period],
      periodStartDate: d.periodStartDate,
      periodEndDate: d.periodEndDate,
    };
  }
  if (current) groups.push(current);
  return groups;
}
