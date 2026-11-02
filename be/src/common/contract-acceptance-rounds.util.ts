import {
  AcceptancePaymentStatus,
  AcceptanceStatus,
  BillingCycle,
  DocumentStatus,
} from '@prisma/client';
import {
  endOfCalendarDay,
  endOfPeriod,
  isPastDue,
} from './utils/period-due.util';
import {
  generateAcceptanceBatchWindows,
  generateRevenuePlanWindowsFromContract,
} from './utils/acceptance-batch.util';

export function billingCycleToIntervalMonths(
  cycle: BillingCycle,
): number | null {
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
      return null;
  }
}

/** Số lần NT dự kiến = thời hạn (năm) × 12 / chu kỳ nghiệm thu (billingCycle). */
/** Kỳ YYYY-MM = tháng kết thúc mỗi đợt (từ ngày BĐ HĐ + chu kỳ, không tròn đầu tháng). */
export function generatePeriodsForAcceptanceSchedule(input: {
  startDate: Date;
  durationYears: number;
  billingCycle: BillingCycle;
  endDate?: Date | null;
}): string[] {
  return generateAcceptanceBatchWindows(input).map((w) => w.period);
}

/** Kỳ sinh kế hoạch NT — đợt quý tách 3 tháng (khớp bảng chi tiết dashboard). */
export function generatePeriodsForRevenuePlanSchedule(input: {
  startDate: Date;
  durationYears: number;
  billingCycle: BillingCycle;
  endDate?: Date | null;
}): string[] {
  return generateRevenuePlanWindowsFromContract(input).map((w) => w.period);
}

/** Sinh các kỳ NT trong khoảng [fromPeriod, toPeriod] theo chu kỳ HĐ (kỳ đầu = fromPeriod). */
export function generatePeriodsInBillingRange(input: {
  fromPeriod: string;
  toPeriod: string;
  billingCycle: BillingCycle;
}): string[] {
  const { fromPeriod, toPeriod, billingCycle } = input;
  if (fromPeriod > toPeriod) {
    return [];
  }

  const interval = billingCycleToIntervalMonths(billingCycle);
  if (interval == null || interval <= 0) {
    return listCalendarMonthsInclusive(fromPeriod, toPeriod);
  }

  const periods: string[] = [];
  const [y0, m0] = fromPeriod.split('-').map(Number);
  const cursor = new Date(Date.UTC(y0, m0 - 1, 1));
  const [y1, m1] = toPeriod.split('-').map(Number);
  const end = new Date(Date.UTC(y1, m1 - 1, 1));

  while (cursor <= end) {
    const year = cursor.getUTCFullYear();
    const month = String(cursor.getUTCMonth() + 1).padStart(2, '0');
    periods.push(`${year}-${month}`);
    cursor.setUTCMonth(cursor.getUTCMonth() + interval);
  }
  return periods;
}

function listCalendarMonthsInclusive(
  fromPeriod: string,
  toPeriod: string,
): string[] {
  const [fy, fm] = fromPeriod.split('-').map(Number);
  const [ty, tm] = toPeriod.split('-').map(Number);
  const start = new Date(Date.UTC(fy, fm - 1, 1));
  const end = new Date(Date.UTC(ty, tm - 1, 1));
  const out: string[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    out.push(
      `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, '0')}`,
    );
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return out;
}

export function expectedAcceptanceRounds(input: {
  durationYears?: number | null;
  billingCycle?: BillingCycle;
}): number | null {
  const years = input.durationYears;
  if (years == null || years <= 0) return null;
  const interval = input.billingCycle
    ? billingCycleToIntervalMonths(input.billingCycle)
    : null;
  if (interval == null || interval <= 0) return null;
  return Math.max(1, Math.floor((years * 12) / interval));
}

export function isActiveAcceptance(status: AcceptanceStatus): boolean {
  return (
    status !== AcceptanceStatus.REJECTED &&
    status !== AcceptanceStatus.CANCELLED
  );
}

export type AcceptanceRoundRow = {
  scheduleId?: string | null;
  period: string;
  status: AcceptanceStatus;
  documentStatus: DocumentStatus;
  paymentStatus: AcceptancePaymentStatus;
};

export function isCollectedAcceptanceRound(row: AcceptanceRoundRow): boolean {
  return (
    isActiveAcceptance(row.status) &&
    row.paymentStatus === AcceptancePaymentStatus.COLLECTED
  );
}

/** Tổng đợt NT: ưu tiên thời hạn HĐ × chu kỳ (vd. 1 năm/tháng = 12, 1 năm/3 tháng = 4). */
export function resolveTotalAcceptanceRounds(input: {
  scheduleCount: number;
  expectedRounds: number | null;
  plannedInstallmentCount: number;
}): number {
  if (input.expectedRounds != null && input.expectedRounds > 0) {
    return input.expectedRounds;
  }
  if (input.scheduleCount > 0) return input.scheduleCount;
  if (input.plannedInstallmentCount > 0) return input.plannedInstallmentCount;
  return 0;
}

export function isSubmittedDocumentRound(row: AcceptanceRoundRow): boolean {
  return (
    isActiveAcceptance(row.status) &&
    row.documentStatus === DocumentStatus.SUBMITTED_UNPAID
  );
}

/** Đếm đợt đã nộp hồ sơ (mỗi schedule hoặc kỳ tối đa 1 đợt). */
export function countSubmittedDocumentAcceptanceRounds(
  rows: Array<AcceptanceRoundRow & { scheduleId?: string | null }>,
): number {
  const seen = new Set<string>();
  let count = 0;
  for (const row of rows) {
    if (!isSubmittedDocumentRound(row)) continue;
    const key = row.scheduleId
      ? `schedule:${row.scheduleId}`
      : `period:${row.period}`;
    if (seen.has(key)) continue;
    seen.add(key);
    count += 1;
  }
  return count;
}

export function countCollectedAcceptanceRounds(
  rows: AcceptanceRoundRow[],
): number {
  return rows.filter(isCollectedAcceptanceRound).length;
}

export function countPendingDocAcceptanceRounds(
  rows: AcceptanceRoundRow[],
): number {
  return rows.filter(
    (a) =>
      isActiveAcceptance(a.status) &&
      a.documentStatus === DocumentStatus.NOT_SUBMITTED,
  ).length;
}

export function countLateAcceptanceRounds(input: {
  now: Date;
  schedules: Array<{
    id: string;
    dueDate: Date | null;
    endPeriod: string | null;
    startPeriod: string | null;
  }>;
  plans: Array<{
    period: string;
    plannedAcceptanceDate: Date | null;
    plannedAmount: { gt: (n: number) => boolean } | number | string;
  }>;
  acceptances: AcceptanceRoundRow[];
}): number {
  const { now, schedules, plans, acceptances } = input;

  const hasCollectedForSchedule = (scheduleId: string) =>
    acceptances.some(
      (a) => a.scheduleId === scheduleId && isCollectedAcceptanceRound(a),
    );

  const hasCollectedForPeriod = (period: string) =>
    acceptances.some(
      (a) => a.period === period && isCollectedAcceptanceRound(a),
    );

  if (schedules.length > 0) {
    let late = 0;
    for (const sch of schedules) {
      if (hasCollectedForSchedule(sch.id)) continue;
      const due =
        (sch.dueDate ? endOfCalendarDay(sch.dueDate) : null) ??
        (sch.endPeriod ? endOfPeriod(sch.endPeriod) : null) ??
        (sch.startPeriod ? endOfPeriod(sch.startPeriod) : null);
      if (due && isPastDue(due, now)) late += 1;
    }
    return late;
  }

  let late = 0;
  for (const plan of plans) {
    const amount =
      typeof plan.plannedAmount === 'object' &&
      plan.plannedAmount !== null &&
      'gt' in plan.plannedAmount
        ? plan.plannedAmount.gt(0)
        : Number(plan.plannedAmount) > 0;
    if (!amount) continue;
    if (hasCollectedForPeriod(plan.period)) continue;
    const due =
      (plan.plannedAcceptanceDate
        ? endOfCalendarDay(plan.plannedAcceptanceDate)
        : null) ?? endOfPeriod(plan.period);
    if (due && isPastDue(due, now)) late += 1;
  }
  return late;
}

export function formatAcceptanceRoundHint(stats: {
  total: number;
  submittedRounds: number;
  collectedRounds: number;
  remaining: number;
  lateRounds: number;
  pendingDocRounds: number;
  submittedWithoutPlan: number;
  collectedWithoutPlan: number;
}): string {
  const {
    total,
    submittedRounds,
    collectedRounds,
    remaining,
    lateRounds,
    pendingDocRounds,
    submittedWithoutPlan,
    collectedWithoutPlan,
  } = stats;
  if (total <= 0) {
    if (submittedWithoutPlan > 0 || collectedWithoutPlan > 0) {
      const parts: string[] = [];
      if (submittedWithoutPlan > 0) {
        parts.push(`Đã nghiệm thu ${submittedWithoutPlan} đợt`);
      }
      if (collectedWithoutPlan > 0) {
        parts.push(`đã thu tiền ${collectedWithoutPlan} đợt`);
      }
      return `${parts.join(' · ')} (chưa khai báo thời hạn/chu kỳ NT trên HĐ)`;
    }
    return 'Nhập thời hạn (năm) và chu kỳ nghiệm thu trên hợp đồng';
  }
  let hint = `Đã nghiệm thu ${submittedRounds}/${total} đợt · còn ${remaining} đợt`;
  if (collectedRounds > 0) {
    hint += ` · đã thu tiền ${collectedRounds} đợt`;
  }
  if (lateRounds > 0) hint += ` · ${lateRounds} trễ kế hoạch`;
  if (pendingDocRounds > 0) hint += ` · ${pendingDocRounds} đợt chưa nộp HS`;
  return hint;
}
