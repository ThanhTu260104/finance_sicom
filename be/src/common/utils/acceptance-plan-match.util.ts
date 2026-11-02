import { Decimal } from '@prisma/client/runtime/library';
import { parseBatchSequenceFromAcceptanceNo } from './acceptance-batch.util';

export type AcceptanceForPlanMatch = {
  acceptanceNo: string;
  period: string;
  scheduleId: string | null;
  amount: Decimal;
};

export type PlanForAcceptanceMatch = {
  batchSequence: number | null;
  scheduleId: string | null;
  period: string;
  periodStartDate?: Date | null;
  periodEndDate?: Date | null;
};

export type AcceptanceForPlanMatchDetailed = AcceptanceForPlanMatch & {
  acceptanceDate?: Date | null;
};

function calendarDayInRange(
  date: Date,
  start: Date,
  end: Date,
): boolean {
  return date.getTime() >= start.getTime() && date.getTime() <= end.getTime();
}

/** NT khớp dòng KH tháng (đợt nhỏ): cùng kỳ period hoặc cùng đợt + ngày NT trong khoảng KH. */
export function acceptanceMatchesRevenuePlan(
  acceptance: AcceptanceForPlanMatchDetailed,
  plan: PlanForAcceptanceMatch,
  contractPlanPeriods?: ReadonlySet<string>,
): boolean {
  if (acceptance.period === plan.period) {
    return true;
  }
  if (
    contractPlanPeriods?.has(acceptance.period) &&
    acceptance.period !== plan.period
  ) {
    return false;
  }
  if (
    plan.periodStartDate &&
    plan.periodEndDate &&
    acceptance.acceptanceDate &&
    !Number.isNaN(acceptance.acceptanceDate.getTime()) &&
    calendarDayInRange(
      acceptance.acceptanceDate,
      plan.periodStartDate,
      plan.periodEndDate,
    )
  ) {
    return true;
  }
  const batch = parseBatchSequenceFromAcceptanceNo(acceptance.acceptanceNo);
  if (
    plan.batchSequence == null ||
    batch == null ||
    batch !== plan.batchSequence
  ) {
    return false;
  }
  return false;
}

export function subBatchIndexForPlan<
  T extends {
    id?: string;
    batchSequence: number | null;
    period: string;
  },
>(plan: T, contractPlans: T[]): number | null {
  if (plan.batchSequence == null) return null;
  const siblings = contractPlans
    .filter((p) => p.batchSequence === plan.batchSequence)
    .sort((a, b) => a.period.localeCompare(b.period));
  const idx = siblings.findIndex(
    (p) => p.period === plan.period || (plan.id && p.id === plan.id),
  );
  return idx >= 0 ? idx + 1 : null;
}

export type AcceptancePlanAggregates = {
  byPeriod: Map<string, Decimal>;
  byBatch: Map<number, Decimal>;
  bySchedule: Map<string, Decimal>;
};

export function buildAcceptancePlanAggregates(
  acceptances: AcceptanceForPlanMatch[],
): AcceptancePlanAggregates {
  const byPeriod = new Map<string, Decimal>();
  const byBatch = new Map<number, Decimal>();
  const bySchedule = new Map<string, Decimal>();

  for (const row of acceptances) {
    const cur = byPeriod.get(row.period) ?? new Decimal(0);
    byPeriod.set(row.period, cur.add(row.amount));

    const batch = parseBatchSequenceFromAcceptanceNo(row.acceptanceNo);
    if (batch != null) {
      const b = byBatch.get(batch) ?? new Decimal(0);
      byBatch.set(batch, b.add(row.amount));
    }
    if (row.scheduleId) {
      const s = bySchedule.get(row.scheduleId) ?? new Decimal(0);
      bySchedule.set(row.scheduleId, s.add(row.amount));
    }
  }

  return { byPeriod, byBatch, bySchedule };
}

/**
 * Khớp NT với dòng kế hoạch — **không** parse số đợt từ acceptanceNo (dễ lệch).
 * VD: đợt KH tháng 9 (`period=2026-09`), NT thực tế ngày 10/10 → vẫn khớp plan tháng 9.
 */
export function sumAcceptanceForPlan(
  plan: PlanForAcceptanceMatch,
  aggregates: AcceptancePlanAggregates,
  acceptances?: AcceptanceForPlanMatchDetailed[],
  contractPlanPeriods?: ReadonlySet<string>,
): Decimal {
  if (plan.scheduleId) {
    const bySchedule = aggregates.bySchedule.get(plan.scheduleId);
    if (bySchedule && bySchedule.gt(0)) return bySchedule;
  }

  if (acceptances && acceptances.length > 0) {
    let sum = new Decimal(0);
    for (const row of acceptances) {
      if (acceptanceMatchesRevenuePlan(row, plan, contractPlanPeriods)) {
        sum = sum.add(row.amount);
      }
    }
    return sum;
  }

  return aggregates.byPeriod.get(plan.period) ?? new Decimal(0);
}
