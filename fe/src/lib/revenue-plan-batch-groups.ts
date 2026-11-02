import type { PeriodComparison } from '@/lib/types';
import {
  generateAcceptanceBatchWindows,
  type ContractAcceptanceScheduleInput,
} from '@/lib/acceptance-plan-periods';

export type RevenuePlanBatchGroup = {
  batchSequence: number;
  batchPeriodStartDate: string | null;
  batchPeriodEndDate: string | null;
  plannedTotal: string;
  actualTotal: string;
  varianceTotal: string;
  slices: PeriodComparison[];
};

function sumDecimalStrings(values: string[]): string {
  const total = values.reduce((acc, v) => acc + Number(v || 0), 0);
  return total.toFixed(2);
}

export function groupRevenuePlanRows(
  rows: PeriodComparison[],
  contractMeta: ContractAcceptanceScheduleInput,
): RevenuePlanBatchGroup[] {
  const planRows = rows.filter((r) => r.revenuePlanId);
  if (planRows.length === 0) return [];

  const batchWindows =
    contractMeta.startDate &&
    contractMeta.durationYears != null &&
    contractMeta.durationYears > 0
      ? generateAcceptanceBatchWindows({
          startDate: new Date(contractMeta.startDate),
          durationYears: contractMeta.durationYears,
          billingCycle: contractMeta.billingCycle,
          endDate: contractMeta.endDate
            ? new Date(contractMeta.endDate)
            : null,
        })
      : [];

  const byBatch = new Map<number, PeriodComparison[]>();
  for (const row of planRows) {
    const batch = row.batchSequence ?? 0;
    if (batch <= 0) continue;
    const list = byBatch.get(batch) ?? [];
    list.push(row);
    byBatch.set(batch, list);
  }

  return [...byBatch.entries()]
    .sort(([a], [b]) => a - b)
    .map(([batchSequence, slices]) => {
      const sorted = [...slices].sort((a, b) =>
        a.period.localeCompare(b.period),
      );
      const win = batchWindows.find((w) => w.batchSequence === batchSequence);
      return {
        batchSequence,
        batchPeriodStartDate:
          win?.periodStartDate.toISOString() ??
          sorted[0]?.periodStartDate ??
          null,
        batchPeriodEndDate:
          win?.periodEndDate.toISOString() ??
          sorted[sorted.length - 1]?.periodEndDate ??
          null,
        plannedTotal: sumDecimalStrings(sorted.map((s) => s.plannedAmount)),
        actualTotal: sumDecimalStrings(
          sorted.map((s) => s.actualAmount ?? '0'),
        ),
        varianceTotal: sumDecimalStrings(sorted.map((s) => s.variance)),
        slices: sorted,
      };
    });
}

export type AcceptanceBatchPlanOption = {
  batchSequence: number;
  periodStartDate: string | null;
  periodEndDate: string | null;
  plannedTotal: string;
  /** Tháng mặc định gắn NT (tháng kết thúc đợt NT). */
  defaultPeriod: string;
  revenuePlanId: string | null;
  scheduleId: string | null;
};

/** 4 đợt NT lớn — không liệt kê 12 dòng KH tháng trong form nghiệm thu. */
export function buildAcceptanceBatchOptions(
  rows: PeriodComparison[],
  contractMeta: ContractAcceptanceScheduleInput,
): AcceptanceBatchPlanOption[] {
  const batchWindows =
    contractMeta.startDate &&
    contractMeta.durationYears != null &&
    contractMeta.durationYears > 0
      ? generateAcceptanceBatchWindows({
          startDate: new Date(contractMeta.startDate),
          durationYears: contractMeta.durationYears,
          billingCycle: contractMeta.billingCycle,
          endDate: contractMeta.endDate
            ? new Date(contractMeta.endDate)
            : null,
        })
      : [];

  const planRows = rows.filter((r) => r.revenuePlanId);
  const byBatch = new Map<number, PeriodComparison[]>();
  for (const row of planRows) {
    const batch = row.batchSequence ?? 0;
    if (batch <= 0) continue;
    const list = byBatch.get(batch) ?? [];
    list.push(row);
    byBatch.set(batch, list);
  }

  const batchSequences = new Set([
    ...batchWindows.map((w) => w.batchSequence),
    ...byBatch.keys(),
  ]);

  return [...batchSequences]
    .sort((a, b) => a - b)
    .map((batchSequence) => {
      const slices = [...(byBatch.get(batchSequence) ?? [])].sort((a, b) =>
        a.period.localeCompare(b.period),
      );
      const win = batchWindows.find((w) => w.batchSequence === batchSequence);
      const plannedTotal =
        slices.length > 0
          ? sumDecimalStrings(slices.map((s) => s.plannedAmount))
          : '0';
      const anchor = slices[0];
      return {
        batchSequence,
        periodStartDate:
          win?.periodStartDate.toISOString() ??
          anchor?.periodStartDate ??
          null,
        periodEndDate:
          win?.periodEndDate.toISOString() ??
          slices[slices.length - 1]?.periodEndDate ??
          null,
        plannedTotal,
        defaultPeriod: win?.period ?? anchor?.period ?? '',
        revenuePlanId: anchor?.revenuePlanId ?? null,
        scheduleId: anchor?.scheduleId ?? null,
      };
    });
}

export function formatSubBatchLabel(
  batchSequence: number,
  sliceIndex: number,
): string {
  return `Đợt ${batchSequence}-${sliceIndex}`;
}

/** Nhãn dòng KH trên dashboard / chi tiết — đợt 2-2 chỉ khi HĐ NT > 1 tháng/lần. */
export function formatPlanSliceDisplayLabel(
  slice: {
    batchSequence?: number | null;
    subBatchIndex?: number | null;
    period?: string;
  },
  multiMonthAcceptanceBatch: boolean,
): string {
  if (
    multiMonthAcceptanceBatch &&
    slice.batchSequence != null &&
    slice.subBatchIndex != null &&
    slice.subBatchIndex > 0
  ) {
    return formatSubBatchLabel(slice.batchSequence, slice.subBatchIndex);
  }
  if (slice.batchSequence != null) {
    return `Đợt ${slice.batchSequence}`;
  }
  return slice.period ?? 'Kỳ KH';
}

export type PlanDraftPreviewItem = {
  period: string;
  plannedAmount: string;
  batchSequence?: number | null;
  periodStartDate?: string | null;
  periodEndDate?: string | null;
};

export type PlanDraftBatchGroup = {
  batchSequence: number;
  batchPeriodStartDate: string | null;
  batchPeriodEndDate: string | null;
  plannedTotal: string;
  slices: PlanDraftPreviewItem[];
};

export function groupPlanDraftItems(
  items: PlanDraftPreviewItem[],
  contractMeta: ContractAcceptanceScheduleInput,
): PlanDraftBatchGroup[] {
  if (items.length === 0) return [];

  const batchWindows =
    contractMeta.startDate &&
    contractMeta.durationYears != null &&
    contractMeta.durationYears > 0
      ? generateAcceptanceBatchWindows({
          startDate: new Date(contractMeta.startDate),
          durationYears: contractMeta.durationYears,
          billingCycle: contractMeta.billingCycle,
          endDate: contractMeta.endDate
            ? new Date(contractMeta.endDate)
            : null,
        })
      : [];

  const byBatch = new Map<number, PlanDraftPreviewItem[]>();
  for (const item of items) {
    const batch = item.batchSequence ?? 0;
    if (batch <= 0) continue;
    const list = byBatch.get(batch) ?? [];
    list.push(item);
    byBatch.set(batch, list);
  }

  return [...byBatch.entries()]
    .sort(([a], [b]) => a - b)
    .map(([batchSequence, slices]) => {
      const sorted = [...slices].sort((a, b) =>
        a.period.localeCompare(b.period),
      );
      const win = batchWindows.find((w) => w.batchSequence === batchSequence);
      return {
        batchSequence,
        batchPeriodStartDate:
          win?.periodStartDate.toISOString() ??
          sorted[0]?.periodStartDate ??
          null,
        batchPeriodEndDate:
          win?.periodEndDate.toISOString() ??
          sorted[sorted.length - 1]?.periodEndDate ??
          null,
        plannedTotal: sumDecimalStrings(sorted.map((s) => s.plannedAmount)),
        slices: sorted,
      };
    });
}
