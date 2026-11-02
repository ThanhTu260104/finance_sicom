import { Decimal } from '@prisma/client/runtime/library';
import { toDecimalString } from './decimal.util';
import { parseBatchSequenceFromAcceptanceNo } from './acceptance-batch.util';
import { acceptanceIdFromAutoCollectionNo } from './acceptance-collection.sync';
import { periodFromVnCalendarDate } from './calendar-date-vn.util';

type Amount = Decimal | string | number;

export type BatchTrendPlan = {
  period: string;
  batchSequence: number | null;
  periodStartDate: Date | null;
  periodEndDate: Date | null;
  plannedAmount: Amount;
};

export type BatchTrendWindow = {
  batchSequence: number;
  periodStartDate: Date;
  periodEndDate: Date;
};

export type BatchTrendInput = {
  plans: BatchTrendPlan[];
  /** Lịch đợt sinh từ HĐ (bổ sung đợt chưa lập KH) */
  windows: BatchTrendWindow[];
  /** NT được tính (đã duyệt + đã nộp HS) */
  acceptances: Array<{
    id: string;
    acceptanceNo: string;
    period: string;
    amount: Amount;
  }>;
  /** Mọi NT của HĐ — để gán thu tự động NT/{id} về đúng đợt */
  allAcceptances: Array<{ id: string; acceptanceNo: string; period: string }>;
  collections: Array<{ collectionNo: string; period: string; amount: Amount }>;
  monthlyFinancials: Array<{ period: string; actualWorkAmount: Amount }>;
  /** Hôm nay (để xác định đợt hiện tại) */
  now: Date;
};

export type BatchTrendPoint = {
  /** Tháng bắt đầu đợt (YYYY-MM) — khóa sắp xếp / lọc trên biểu đồ */
  period: string;
  label: string;
  batchSequence: number;
  periodStartDate: string;
  periodEndDate: string;
  plannedAcceptance: string;
  plannedAcceptanceCumulative: string;
  actualAcceptance: string;
  actualAcceptanceCumulative: string;
  actualAcceptancePlanPeriod: string;
  actualAcceptancePlanPeriodCumulative: string;
  actualCollection: string;
  actualCollectionCumulative: string;
  actualCollectionPlanPeriod: string;
  actualCollectionPlanPeriodCumulative: string;
  actualWork: string;
  actualWorkCumulative: string;
  operatingCost: string;
  operatingCostCumulative: string;
  acceptanceGap: string;
  acceptanceGapPeriod: string;
  acceptanceProgressPeriod: string;
};

type BatchBucket = {
  batchSequence: number;
  start: Date;
  end: Date;
  startPeriod: string;
  planned: Decimal;
  accepted: Decimal;
  collected: Decimal;
  actualWork: Decimal;
};

export type ContractBatchSpan = {
  batchSequence: number;
  start: Date;
  end: Date;
  /** Tháng bắt đầu đợt (YYYY-MM) */
  startPeriod: string;
};

export type ContractBatchResolver = {
  /** Các đợt, theo thứ tự */
  batches: ContractBatchSpan[];
  forPeriod: (period: string) => number;
  forPlan: (plan: { period: string; batchSequence: number | null }) => number;
  /** NT: theo đợt người dùng chọn (mã "Đợt n"), không theo ngày NT */
  forAcceptance: (row: { acceptanceNo: string; period: string }) => number;
  /** Thu tự động NT/{id} → đợt của NT đó; thu tay → theo kỳ */
  forCollection: (row: { collectionNo: string; period: string }) => number;
  startPeriodOf: (batchSequence: number) => string;
  /**
   * Tháng kết thúc đợt (YYYY-MM) — mốc gom đợt trên biểu đồ tháng của dự án / công ty:
   * NT diễn ra cuối đợt, nên KH của đợt chỉ "đến hạn" khi đợt kết thúc.
   */
  endPeriodOf: (batchSequence: number) => string;
};

/**
 * Quy tắc gán dữ liệu vào đợt NT của một HĐ (dùng chung cho biểu đồ theo đợt
 * và bảng tháng của dự án / toàn công ty). Không xác định được đợt → null.
 */
export function createContractBatchResolver(input: {
  plans: BatchTrendPlan[];
  windows: BatchTrendWindow[];
  /** NT dùng để tra thu tự động NT/{id} */
  acceptances: Array<{ id: string; acceptanceNo: string; period: string }>;
}): ContractBatchResolver | null {
  const spans = new Map<number, ContractBatchSpan>();
  const ensure = (seq: number, start: Date, end: Date) => {
    const existing = spans.get(seq);
    if (!existing) {
      spans.set(seq, {
        batchSequence: seq,
        start,
        end,
        startPeriod: periodFromVnCalendarDate(start),
      });
      return;
    }
    if (start < existing.start) {
      existing.start = start;
      existing.startPeriod = periodFromVnCalendarDate(start);
    }
    if (end > existing.end) existing.end = end;
  };

  // Khoảng đợt: ưu tiên ngày trên dòng KH, bổ sung từ lịch HĐ
  for (const plan of input.plans) {
    if (
      plan.batchSequence != null &&
      plan.periodStartDate &&
      plan.periodEndDate
    ) {
      ensure(plan.batchSequence, plan.periodStartDate, plan.periodEndDate);
    }
  }
  for (const w of input.windows) {
    if (!spans.has(w.batchSequence)) {
      ensure(w.batchSequence, w.periodStartDate, w.periodEndDate);
    }
  }
  if (spans.size === 0) return null;

  const batches = [...spans.values()].sort(
    (a, b) => a.batchSequence - b.batchSequence,
  );

  // Kỳ tháng → đợt: dòng KH cùng kỳ; nếu không có thì đợt cuối cùng bắt đầu ≤ kỳ
  const planBatchByPeriod = new Map<string, number>();
  for (const plan of input.plans) {
    if (plan.batchSequence != null && !planBatchByPeriod.has(plan.period)) {
      planBatchByPeriod.set(plan.period, plan.batchSequence);
    }
  }
  const forPeriod = (period: string): number => {
    const fromPlan = planBatchByPeriod.get(period);
    if (fromPlan != null && spans.has(fromPlan)) return fromPlan;
    let found = batches[0].batchSequence;
    for (const b of batches) {
      if (b.startPeriod <= period) found = b.batchSequence;
    }
    return found;
  };
  const forAcceptance = (row: { acceptanceNo: string; period: string }) => {
    const fromNo = parseBatchSequenceFromAcceptanceNo(row.acceptanceNo);
    return fromNo != null && spans.has(fromNo) ? fromNo : forPeriod(row.period);
  };
  const acceptanceById = new Map(input.acceptances.map((a) => [a.id, a]));

  return {
    batches,
    forPeriod,
    forPlan: (plan) =>
      plan.batchSequence != null && spans.has(plan.batchSequence)
        ? plan.batchSequence
        : forPeriod(plan.period),
    forAcceptance,
    forCollection: (row) => {
      const linkedId = acceptanceIdFromAutoCollectionNo(row.collectionNo);
      const linked = linkedId ? acceptanceById.get(linkedId) : undefined;
      return linked ? forAcceptance(linked) : forPeriod(row.period);
    },
    startPeriodOf: (seq) =>
      spans.get(seq)?.startPeriod ?? batches[0].startPeriod,
    endPeriodOf: (seq) =>
      periodFromVnCalendarDate((spans.get(seq) ?? batches[0]).end),
  };
}

/**
 * Gom KH / NT / thu / thực hiện theo **đợt nghiệm thu** (HĐ chu kỳ > 1 tháng).
 * - KH: theo batchSequence của dòng KH (1.1, 1.2, 1.3 → đợt 1).
 * - NT: theo đợt người dùng chọn (mã "Đợt n"), không theo ngày NT hay kỳ tháng.
 * - Thu tự động NT/{id}: theo đợt của NT đó; thu tay: theo kỳ → đợt chứa kỳ.
 */
export function buildContractBatchTrend(input: BatchTrendInput): {
  points: BatchTrendPoint[];
  currentBatchPeriod: string | null;
} {
  const resolver = createContractBatchResolver({
    plans: input.plans,
    windows: input.windows,
    acceptances: input.allAcceptances,
  });
  if (!resolver) {
    return { points: [], currentBatchPeriod: null };
  }

  const buckets = new Map<number, BatchBucket>(
    resolver.batches.map((b) => [
      b.batchSequence,
      {
        ...b,
        planned: new Decimal(0),
        accepted: new Decimal(0),
        collected: new Decimal(0),
        actualWork: new Decimal(0),
      },
    ]),
  );
  const ordered = () =>
    [...buckets.values()].sort((a, b) => a.batchSequence - b.batchSequence);

  for (const plan of input.plans) {
    const b = buckets.get(resolver.forPlan(plan))!;
    b.planned = b.planned.add(plan.plannedAmount);
  }
  for (const row of input.acceptances) {
    const b = buckets.get(resolver.forAcceptance(row))!;
    b.accepted = b.accepted.add(row.amount);
  }
  for (const row of input.collections) {
    const b = buckets.get(resolver.forCollection(row))!;
    b.collected = b.collected.add(row.amount);
  }
  for (const row of input.monthlyFinancials) {
    const b = buckets.get(resolver.forPeriod(row.period))!;
    b.actualWork = b.actualWork.add(row.actualWorkAmount);
  }

  let cumPlanned = new Decimal(0);
  let cumAccepted = new Decimal(0);
  let cumCollected = new Decimal(0);
  let cumWork = new Decimal(0);
  let currentBatchPeriod: string | null = null;
  const nowTime = input.now.getTime();

  const points = ordered().map((b) => {
    cumPlanned = cumPlanned.add(b.planned);
    cumAccepted = cumAccepted.add(b.accepted);
    cumCollected = cumCollected.add(b.collected);
    cumWork = cumWork.add(b.actualWork);
    // Ngày kết thúc đợt tính hết ngày (23:59 VN)
    if (
      nowTime >= b.start.getTime() &&
      nowTime < b.end.getTime() + 24 * 60 * 60 * 1000
    ) {
      currentBatchPeriod = b.startPeriod;
    }
    const gap = b.planned.sub(b.accepted);
    return {
      period: b.startPeriod,
      label: `Đợt ${b.batchSequence}`,
      batchSequence: b.batchSequence,
      periodStartDate: b.start.toISOString(),
      periodEndDate: b.end.toISOString(),
      plannedAcceptance: toDecimalString(b.planned),
      plannedAcceptanceCumulative: toDecimalString(cumPlanned),
      actualAcceptance: toDecimalString(b.accepted),
      actualAcceptanceCumulative: toDecimalString(cumAccepted),
      actualAcceptancePlanPeriod: toDecimalString(b.accepted),
      actualAcceptancePlanPeriodCumulative: toDecimalString(cumAccepted),
      actualCollection: toDecimalString(b.collected),
      actualCollectionCumulative: toDecimalString(cumCollected),
      actualCollectionPlanPeriod: toDecimalString(b.collected),
      actualCollectionPlanPeriodCumulative: toDecimalString(cumCollected),
      actualWork: toDecimalString(b.actualWork),
      actualWorkCumulative: toDecimalString(cumWork),
      operatingCost: '0',
      operatingCostCumulative: '0',
      acceptanceGap: toDecimalString(cumPlanned.sub(cumAccepted)),
      acceptanceGapPeriod: toDecimalString(gap),
      acceptanceProgressPeriod: b.planned.isZero()
        ? '0.00'
        : b.accepted.div(b.planned).mul(100).toFixed(2),
    };
  });

  return { points, currentBatchPeriod };
}

const SUMMED_KEYS = [
  'plannedAcceptance',
  'actualAcceptance',
  'actualCollection',
  'actualWork',
] as const;

/**
 * Gộp biểu đồ theo đợt của nhiều HĐ (vd. dự án) — chỉ khi mọi HĐ có **cùng lịch đợt**
 * (cùng ngày bắt đầu / kết thúc từng đợt). Khác lịch → null (dùng biểu đồ theo tháng).
 */
export function mergeContractBatchTrends(
  trends: Array<{
    points: BatchTrendPoint[];
    currentBatchPeriod: string | null;
  }>,
): { points: BatchTrendPoint[]; currentBatchPeriod: string | null } | null {
  const nonEmpty = trends.filter((t) => t.points.length > 0);
  if (nonEmpty.length === 0) return null;
  const signature = (t: { points: BatchTrendPoint[] }) =>
    t.points
      .map(
        (p) =>
          `${p.periodStartDate.slice(0, 10)}~${p.periodEndDate.slice(0, 10)}`,
      )
      .join('|');
  const first = signature(nonEmpty[0]);
  if (nonEmpty.some((t) => signature(t) !== first)) return null;
  if (nonEmpty.length === 1) return nonEmpty[0];

  const cum = {
    plannedAcceptance: new Decimal(0),
    actualAcceptance: new Decimal(0),
    actualCollection: new Decimal(0),
    actualWork: new Decimal(0),
  };
  const points = nonEmpty[0].points.map((base, i) => {
    const sums = Object.fromEntries(
      SUMMED_KEYS.map((key) => [
        key,
        nonEmpty.reduce((acc, t) => acc.add(t.points[i][key]), new Decimal(0)),
      ]),
    ) as Record<(typeof SUMMED_KEYS)[number], Decimal>;
    for (const key of SUMMED_KEYS) cum[key] = cum[key].add(sums[key]);
    const gap = sums.plannedAcceptance.sub(sums.actualAcceptance);
    return {
      ...base,
      plannedAcceptance: toDecimalString(sums.plannedAcceptance),
      plannedAcceptanceCumulative: toDecimalString(cum.plannedAcceptance),
      actualAcceptance: toDecimalString(sums.actualAcceptance),
      actualAcceptanceCumulative: toDecimalString(cum.actualAcceptance),
      actualAcceptancePlanPeriod: toDecimalString(sums.actualAcceptance),
      actualAcceptancePlanPeriodCumulative: toDecimalString(
        cum.actualAcceptance,
      ),
      actualCollection: toDecimalString(sums.actualCollection),
      actualCollectionCumulative: toDecimalString(cum.actualCollection),
      actualCollectionPlanPeriod: toDecimalString(sums.actualCollection),
      actualCollectionPlanPeriodCumulative: toDecimalString(
        cum.actualCollection,
      ),
      actualWork: toDecimalString(sums.actualWork),
      actualWorkCumulative: toDecimalString(cum.actualWork),
      acceptanceGap: toDecimalString(
        cum.plannedAcceptance.sub(cum.actualAcceptance),
      ),
      acceptanceGapPeriod: toDecimalString(gap),
      acceptanceProgressPeriod: sums.plannedAcceptance.isZero()
        ? '0.00'
        : sums.actualAcceptance.div(sums.plannedAcceptance).mul(100).toFixed(2),
    };
  });
  return { points, currentBatchPeriod: nonEmpty[0].currentBatchPeriod };
}
