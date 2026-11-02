import type { BillingCycle } from '@/lib/types';
import {
  calendarYmdInVn,
  endOfVnCalendarDay,
  normalizeContractCalendarDate,
  periodFromVnCalendarDate,
  utcDateFromVnYmd,
} from '@/lib/calendar-date-vn';

function billingCycleToIntervalMonths(cycle: BillingCycle): number | null {
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

function listCalendarMonthsInclusive(
  fromPeriod: string,
  toPeriod: string,
): string[] {
  if (fromPeriod > toPeriod) return [];
  const [fy, fm] = fromPeriod.split('-').map(Number);
  const [ty, tm] = toPeriod.split('-').map(Number);
  const cursor = new Date(Date.UTC(fy, fm - 1, 1));
  const end = new Date(Date.UTC(ty, tm - 1, 1));
  const out: string[] = [];
  while (cursor <= end) {
    out.push(
      `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, '0')}`,
    );
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return out;
}

export type ContractAcceptanceScheduleInput = {
  startDate?: string | null;
  endDate?: string | null;
  durationYears?: number | null;
  billingCycle: BillingCycle;
};

function addMonthsPreserveDayUtc(start: Date, months: number): Date {
  const { year, month, day } = calendarYmdInVn(start);
  const anchorMonth = month - 1 + months;
  const anchor = new Date(Date.UTC(year, anchorMonth, 1));
  const lastDay = new Date(
    Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 0),
  ).getUTCDate();
  const clamped = Math.min(day, lastDay);
  return utcDateFromVnYmd(
    anchor.getUTCFullYear(),
    anchor.getUTCMonth() + 1,
    clamped,
  );
}

function subtractOneVnCalendarDay(d: Date): Date {
  const { year, month, day } = calendarYmdInVn(d);
  const anchor = utcDateFromVnYmd(year, month, day);
  const prev = new Date(anchor.getTime() - 86_400_000);
  const { year: y, month: m, day: dd } = calendarYmdInVn(prev);
  return utcDateFromVnYmd(y, m, dd);
}

export type AcceptanceBatchWindow = {
  batchSequence: number;
  period: string;
  periodStartDate: Date;
  periodEndDate: Date;
};

/** Khớp BE — khoảng ngày từng đợt (20/01 → 19/02, 20/02 → 19/03…). */
export function generateAcceptanceBatchWindows(input: {
  startDate: Date;
  durationYears: number;
  billingCycle: BillingCycle;
  endDate?: Date | null;
}): AcceptanceBatchWindow[] {
  const rounds = expectedAcceptanceRounds({
    durationYears: input.durationYears,
    billingCycle: input.billingCycle,
  });
  const interval = billingCycleToIntervalMonths(input.billingCycle);
  if (rounds == null || rounds <= 0 || interval == null || interval <= 0) {
    return [];
  }

  const contractStart = normalizeContractCalendarDate(input.startDate);
  const endByDuration = subtractOneVnCalendarDay(
    addMonthsPreserveDayUtc(contractStart, input.durationYears * 12),
  );
  const contractEnd = input.endDate
    ? endOfVnCalendarDay(normalizeContractCalendarDate(input.endDate))
    : endByDuration;

  const out: AcceptanceBatchWindow[] = [];
  for (let i = 0; i < rounds; i++) {
    const periodStartDate = addMonthsPreserveDayUtc(contractStart, i * interval);
    const nextStart = addMonthsPreserveDayUtc(
      contractStart,
      (i + 1) * interval,
    );
    let periodEndDate = subtractOneVnCalendarDay(nextStart);
    const contractEndDay = normalizeContractCalendarDate(contractEnd);
    if (periodEndDate.getTime() > contractEndDay.getTime()) {
      periodEndDate = contractEndDay;
    }
    out.push({
      batchSequence: i + 1,
      period: periodFromVnCalendarDate(periodEndDate),
      periodStartDate,
      periodEndDate,
    });
  }
  return out;
}

/** Tách đợt NT thành đúng N tháng (N = chu kỳ HĐ), không lặp tháng giữa các đợt. */
export function splitBatchWindowIntoMonthlySlices(
  window: AcceptanceBatchWindow,
  monthCount: number,
): AcceptanceBatchWindow[] {
  if (monthCount <= 1) return [window];

  const slices: AcceptanceBatchWindow[] = [];
  for (let i = 0; i < monthCount; i++) {
    const periodStartDate = addMonthsPreserveDayUtc(
      window.periodStartDate,
      i,
    );
    if (periodStartDate.getTime() > window.periodEndDate.getTime()) {
      break;
    }
    let periodEndDate = subtractOneVnCalendarDay(
      addMonthsPreserveDayUtc(window.periodStartDate, i + 1),
    );
    if (periodEndDate.getTime() > window.periodEndDate.getTime()) {
      periodEndDate = window.periodEndDate;
    }
    slices.push({
      batchSequence: window.batchSequence,
      period: periodFromVnCalendarDate(periodStartDate),
      periodStartDate,
      periodEndDate,
    });
  }
  return slices.length > 0 ? slices : [window];
}

export function generateRevenuePlanWindowsFromContract(input: {
  startDate: Date;
  durationYears: number;
  billingCycle: BillingCycle;
  endDate?: Date | null;
}): AcceptanceBatchWindow[] {
  const batches = generateAcceptanceBatchWindows(input);
  const interval = billingCycleToIntervalMonths(input.billingCycle);
  if (interval == null || interval <= 1) return batches;
  return batches.flatMap((w) => splitBatchWindowIntoMonthlySlices(w, interval));
}

/** Khớp BE — số đợt NT = thời hạn (năm) × 12 / chu kỳ. */
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

/** Kỳ YYYY-MM = tháng kết thúc đợt (rolling từ ngày BĐ HĐ). */
export function generatePeriodsForAcceptanceSchedule(input: {
  startDate: Date;
  durationYears: number;
  billingCycle: BillingCycle;
  endDate?: Date | null;
}): string[] {
  return generateAcceptanceBatchWindows(input).map((w) => w.period);
}

export function contractAcceptanceSchedulePeriods(
  meta: ContractAcceptanceScheduleInput,
): string[] {
  if (!meta.startDate || meta.durationYears == null || meta.durationYears <= 0) {
    return [];
  }
  const start = new Date(meta.startDate);
  if (Number.isNaN(start.getTime())) return [];
  const end = meta.endDate ? new Date(meta.endDate) : null;
  return generateRevenuePlanWindowsFromContract({
    startDate: start,
    durationYears: meta.durationYears,
    billingCycle: meta.billingCycle,
    endDate: end && !Number.isNaN(end.getTime()) ? end : null,
  }).map((w) => w.period);
}

/** Sinh kỳ NT trong khoảng tháng — ưu tiên lịch rolling theo ngày BĐ HĐ. */
export function generatePeriodsInBillingRange(input: {
  fromPeriod: string;
  toPeriod: string;
  billingCycle: BillingCycle;
  startDate?: Date | null;
  durationYears?: number | null;
  endDate?: Date | null;
}): string[] {
  const { fromPeriod, toPeriod, billingCycle } = input;
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(fromPeriod)) return [];
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(toPeriod)) return [];
  if (fromPeriod > toPeriod) return [];

  if (
    input.startDate &&
    input.durationYears != null &&
    input.durationYears > 0
  ) {
    return generateAcceptanceBatchWindows({
      startDate: input.startDate,
      durationYears: input.durationYears,
      billingCycle,
      endDate: input.endDate ?? null,
    })
      .map((w) => w.period)
      .filter((p) => p >= fromPeriod && p <= toPeriod);
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
    periods.push(
      `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, '0')}`,
    );
    cursor.setUTCMonth(cursor.getUTCMonth() + interval);
  }
  return periods;
}

export function acceptanceRoundIndex(
  period: string,
  schedulePeriods: string[],
): number | null {
  const idx = schedulePeriods.indexOf(period);
  return idx >= 0 ? idx + 1 : null;
}

export function formatAcceptanceRoundLabel(roundIndex: number | null): string {
  if (roundIndex == null || roundIndex <= 0) return '—';
  return `Đợt ${roundIndex}`;
}

function endOfPeriodUtc(period: string): Date {
  const [y, m] = period.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));
}

function parseYmdUtc(dateYmd: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateYmd)) return null;
  const [y, m, d] = dateYmd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return Number.isNaN(dt.getTime()) ? null : dt;
}

export function periodFromDateYmd(dateYmd: string): string | null {
  const d = parseYmdUtc(dateYmd);
  if (!d) return null;
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Gán kỳ NT (YYYY-MM) theo ngày thuộc đợt nào trên lịch HĐ. */
export function resolvePeriodForAcceptanceDate(
  dateYmd: string,
  meta: ContractAcceptanceScheduleInput,
): string | null {
  const date = parseYmdUtc(dateYmd);
  if (!date) return null;

  if (
    !meta.startDate ||
    meta.durationYears == null ||
    meta.durationYears <= 0
  ) {
    return periodFromDateYmd(dateYmd);
  }

  const contractStart = new Date(meta.startDate);
  if (Number.isNaN(contractStart.getTime())) {
    return periodFromDateYmd(dateYmd);
  }

  const end = meta.endDate ? new Date(meta.endDate) : null;
  const windows = generateAcceptanceBatchWindows({
    startDate: contractStart,
    durationYears: meta.durationYears,
    billingCycle: meta.billingCycle,
    endDate: end && !Number.isNaN(end.getTime()) ? end : null,
  });

  if (windows.length === 0) {
    return periodFromDateYmd(dateYmd);
  }

  for (const w of windows) {
    if (date >= w.periodStartDate && date <= w.periodEndDate) {
      return w.period;
    }
  }

  if (date < windows[0]!.periodStartDate) {
    return windows[0]!.period;
  }
  return windows[windows.length - 1]!.period;
}

/** Số đợt từ mã NT — «Đợt 13» → 13 (không dùng includes để tránh 13 khớp 1). */
export function parseBatchSequenceFromAcceptanceNo(
  acceptanceNo: string,
): number | null {
  const text = acceptanceNo.trim();
  if (!text) return null;
  const dot = /(?:^|\s)[ĐD]ợt\s*0*(\d+)/iu.exec(text);
  if (dot) return Number(dot[1]);
  const leading = /^0*(\d+)/.exec(text.replace(/\./g, ''));
  if (leading) return Number(leading[1]);
  return null;
}

export function normalizeBatchAcceptanceNo(raw: string): string {
  const text = raw.trim();
  if (!text) return '';
  const batch = parseBatchSequenceFromAcceptanceNo(text);
  if (batch != null) return `Đợt ${batch}`;
  if (/^đợt/i.test(text)) return text;
  return text;
}

export function findPlanRowForAcceptance<
  T extends {
    batchSequence?: number | null;
    period: string;
    revenuePlanId?: string | null;
  },
>(acceptanceNo: string, period: string, planRows: T[]): T | undefined {
  const withPlan = planRows.filter((r) => r.revenuePlanId);
  const batch = parseBatchSequenceFromAcceptanceNo(acceptanceNo);
  if (batch != null) {
    const byBatch = withPlan.find((r) => r.batchSequence === batch);
    if (byBatch) return byBatch;
  }
  return withPlan.find((r) => r.period === period);
}

/** Mã NT duy nhất trên HĐ — cùng đợt nhiều lần: «Đợt 10 · 2». */
export function suggestAcceptanceNoForBatch(
  batch: number,
  existingAcceptanceNos: string[],
  excludeAcceptanceNo?: string,
): string {
  const base = `Đợt ${batch}`;
  const pool = excludeAcceptanceNo
    ? existingAcceptanceNos.filter((no) => no !== excludeAcceptanceNo)
    : existingAcceptanceNos;
  const sameBatch = pool.filter(
    (no) => parseBatchSequenceFromAcceptanceNo(no) === batch,
  );
  if (sameBatch.length === 0) return base;

  let maxIndex = 1;
  for (const no of sameBatch) {
    if (no.trim() === base) {
      maxIndex = Math.max(maxIndex, 1);
      continue;
    }
    const suffix =
      /[·(]\s*(\d+)\s*[)]?\s*$/u.exec(no) ??
      /lần\s*(\d+)/iu.exec(no) ??
      /[-/]\s*(\d+)\s*$/u.exec(no);
    if (suffix) {
      maxIndex = Math.max(maxIndex, Number(suffix[1]));
    }
  }
  return `${base} · ${maxIndex + 1}`;
}

/** Chọn đợt KH → mã NT lúc lưu (giữ mã cũ nếu sửa cùng đợt). */
export function resolveAcceptanceNoForSave(input: {
  batchSequence: number | null | undefined;
  existingAcceptanceNos: string[];
  editingAcceptanceNo?: string | null;
}): string {
  const batch = input.batchSequence;
  if (batch == null || batch <= 0) {
    const legacy = input.editingAcceptanceNo?.trim();
    if (legacy) return legacy;
    const next =
      input.existingAcceptanceNos
        .map((no) => parseBatchSequenceFromAcceptanceNo(no))
        .filter((n): n is number => n != null)
        .reduce((m, n) => Math.max(m, n), 0) + 1;
    return suggestAcceptanceNoForBatch(
      Math.max(1, next),
      input.existingAcceptanceNos,
    );
  }

  const editingNo = input.editingAcceptanceNo?.trim();
  if (editingNo) {
    const prevBatch = parseBatchSequenceFromAcceptanceNo(editingNo);
    if (prevBatch === batch) return editingNo;
  }

  return suggestAcceptanceNoForBatch(
    batch,
    input.existingAcceptanceNos,
    editingNo || undefined,
  );
}

export function previewAcceptanceNoForPlan(input: {
  batchSequence: number | null | undefined;
  existingAcceptanceNos: string[];
  editingAcceptanceNo?: string | null;
}): string {
  return resolveAcceptanceNoForSave(input);
}

export type AcceptanceBatchGroup<T extends { acceptanceNo: string; amount: string }> =
  {
    key: string;
    batchSequence: number | null;
    items: T[];
  };

export function groupAcceptancesByBatch<T extends { id: string; acceptanceNo: string; amount: string }>(
  items: T[],
): AcceptanceBatchGroup<T>[] {
  const sorted = [...items].sort((a, b) => {
    const ba = parseBatchSequenceFromAcceptanceNo(a.acceptanceNo);
    const bb = parseBatchSequenceFromAcceptanceNo(b.acceptanceNo);
    if (ba != null && bb != null && ba !== bb) return ba - bb;
    if (ba != null && bb == null) return -1;
    if (ba == null && bb != null) return 1;
    return a.acceptanceNo.localeCompare(b.acceptanceNo, 'vi');
  });

  const groups: AcceptanceBatchGroup<T>[] = [];
  for (const item of sorted) {
    const batch = parseBatchSequenceFromAcceptanceNo(item.acceptanceNo);
    const key = batch != null ? `batch-${batch}` : `row-${item.id}`;
    const last = groups[groups.length - 1];
    if (batch != null && last?.key === key) {
      last.items.push(item);
    } else {
      groups.push({ key, batchSequence: batch, items: [item] });
    }
  }
  return groups;
}

export function sumAcceptanceAmounts(
  items: Array<{ amount: string }>,
): number {
  return items.reduce((sum, row) => {
    const n = Number(row.amount);
    return sum + (Number.isFinite(n) ? n : 0);
  }, 0);
}
