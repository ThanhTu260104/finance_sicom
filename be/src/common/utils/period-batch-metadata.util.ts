import { BillingCycle } from '@prisma/client';
import { generateAcceptanceBatchWindows } from './acceptance-batch.util';

export type RevenuePlanBatchSource = {
  period: string;
  batchSequence: number | null;
  periodStartDate: Date | null;
  periodEndDate: Date | null;
};

export function monthOverlapsDateRange(
  period: string,
  start: Date,
  end: Date,
): boolean {
  const [y, m] = period.split('-').map(Number);
  const monthStart = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0));
  const monthEnd = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));
  return monthStart <= end && monthEnd >= start;
}

export function findRevenuePlanForPeriod<T extends RevenuePlanBatchSource>(
  period: string,
  planList: T[],
): T | undefined {
  const exact = planList.find((p) => p.period === period);
  if (exact) return exact;
  for (const p of planList) {
    if (!p.periodStartDate || !p.periodEndDate) continue;
    if (monthOverlapsDateRange(period, p.periodStartDate, p.periodEndDate)) {
      return p;
    }
  }
  return undefined;
}

export function acceptanceBatchWindowsForContract(input: {
  startDate: Date | null;
  durationYears: number | null;
  billingCycle: BillingCycle;
  endDate?: Date | null;
}) {
  if (
    !input.startDate ||
    input.durationYears == null ||
    input.durationYears <= 0
  ) {
    return [];
  }
  return generateAcceptanceBatchWindows({
    startDate: input.startDate,
    durationYears: input.durationYears,
    billingCycle: input.billingCycle,
    endDate: input.endDate ?? null,
  });
}

export function resolveBatchMetadataForPeriod(
  period: string,
  plans: RevenuePlanBatchSource[],
  windows: ReturnType<typeof generateAcceptanceBatchWindows>,
): {
  batchSequence: number | null;
  periodStartDate: Date | null;
  periodEndDate: Date | null;
} {
  const revenuePlan = findRevenuePlanForPeriod(period, plans);
  const batchWindow = windows.find((w) =>
    monthOverlapsDateRange(period, w.periodStartDate, w.periodEndDate),
  );
  return {
    batchSequence:
      revenuePlan?.batchSequence ?? batchWindow?.batchSequence ?? null,
    periodStartDate:
      revenuePlan?.periodStartDate ??
      batchWindow?.periodStartDate ??
      null,
    periodEndDate:
      revenuePlan?.periodEndDate ?? batchWindow?.periodEndDate ?? null,
  };
}

export function attachBatchMetadataToTrendPoints<
  T extends { period: string },
>(
  points: T[],
  contract: {
    startDate: Date | null;
    durationYears: number | null;
    billingCycle: BillingCycle;
    endDate?: Date | null;
  },
  plans: RevenuePlanBatchSource[],
): Array<
  T & {
    batchSequence: number | null;
    periodStartDate: string | null;
    periodEndDate: string | null;
  }
> {
  const windows = acceptanceBatchWindowsForContract(contract);
  return points.map((point) => {
    const meta = resolveBatchMetadataForPeriod(point.period, plans, windows);
    return {
      ...point,
      batchSequence: meta.batchSequence,
      periodStartDate: meta.periodStartDate?.toISOString() ?? null,
      periodEndDate: meta.periodEndDate?.toISOString() ?? null,
    };
  });
}
