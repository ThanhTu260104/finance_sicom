import { Decimal } from '@prisma/client/runtime/library';
import { compareDecimals, sumDecimals } from './decimal.util';
import { endOfCalendarDay, endOfPeriod, isPastDue } from './period-due.util';
import {
  sumAcceptanceForPlan,
  type AcceptanceForPlanMatchDetailed,
  type AcceptancePlanAggregates,
} from './acceptance-plan-match.util';

export type RevenuePlanBatchSlice = {
  batchSequence: number | null;
  scheduleId: string | null;
  period: string;
  periodStartDate: Date | null;
  periodEndDate: Date | null;
  plannedAmount: Decimal;
};

export type OverdueAcceptanceBatchNote = {
  batchSequence: number;
  periodStartDate: string | null;
  periodEndDate: string | null;
  plannedAmount: string;
};

function batchWindowEnd(
  plans: RevenuePlanBatchSlice[],
): Date | null {
  let best: Date | null = null;
  for (const p of plans) {
    const candidate =
      (p.periodEndDate && !Number.isNaN(p.periodEndDate.getTime())
        ? endOfCalendarDay(p.periodEndDate)
        : null) ?? endOfPeriod(p.period);
    if (!candidate) continue;
    if (!best || candidate.getTime() > best.getTime()) best = candidate;
  }
  return best;
}

function batchWindowStart(
  plans: RevenuePlanBatchSlice[],
): Date | null {
  let best: Date | null = null;
  for (const p of plans) {
    if (!p.periodStartDate || Number.isNaN(p.periodStartDate.getTime())) {
      continue;
    }
    if (!best || p.periodStartDate.getTime() < best.getTime()) {
      best = p.periodStartDate;
    }
  }
  return best;
}

/** Đợt NT (batchSequence) đã quá hạn cửa sổ KH mà chưa đủ NT thực tế. */
export function listOverdueUnacceptedAcceptanceBatches(input: {
  plans: RevenuePlanBatchSlice[];
  aggregates: AcceptancePlanAggregates;
  acceptances: AcceptanceForPlanMatchDetailed[];
  contractPlanPeriods: ReadonlySet<string>;
  now: Date;
}): OverdueAcceptanceBatchNote[] {
  const byBatch = new Map<number, RevenuePlanBatchSlice[]>();
  for (const plan of input.plans) {
    if (plan.batchSequence == null || plan.batchSequence <= 0) continue;
    if (compareDecimals(plan.plannedAmount, 0) <= 0) continue;
    const list = byBatch.get(plan.batchSequence) ?? [];
    list.push(plan);
    byBatch.set(plan.batchSequence, list);
  }

  const notes: OverdueAcceptanceBatchNote[] = [];
  for (const [batchSequence, slices] of byBatch) {
    const plannedTotal = sumDecimals(slices.map((s) => s.plannedAmount));
    const actualTotal = sumDecimals(
      slices.map((plan) =>
        sumAcceptanceForPlan(
          {
            batchSequence: plan.batchSequence,
            scheduleId: plan.scheduleId,
            period: plan.period,
            periodStartDate: plan.periodStartDate,
            periodEndDate: plan.periodEndDate,
          },
          input.aggregates,
          input.acceptances,
          input.contractPlanPeriods,
        ),
      ),
    );
    if (compareDecimals(actualTotal, plannedTotal) >= 0) continue;

    const dueEnd = batchWindowEnd(slices);
    if (!dueEnd || !isPastDue(dueEnd, input.now)) continue;

    const start = batchWindowStart(slices);
    notes.push({
      batchSequence,
      periodStartDate: start?.toISOString() ?? null,
      periodEndDate: dueEnd.toISOString(),
      plannedAmount: plannedTotal.toFixed(2),
    });
  }

  notes.sort((a, b) => a.batchSequence - b.batchSequence);
  return notes;
}
