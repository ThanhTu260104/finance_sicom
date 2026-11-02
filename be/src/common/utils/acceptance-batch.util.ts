import { BillingCycle } from '@prisma/client';
import {
  billingCycleToIntervalMonths,
  expectedAcceptanceRounds,
} from '../contract-acceptance-rounds.util';
import {
  calendarYmdInVn,
  endOfVnCalendarDay,
  normalizeContractCalendarDate,
  periodFromVnCalendarDate,
  utcDateFromVnYmd,
} from './calendar-date-vn.util';

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

export function periodFromUtcDate(date: Date): string {
  return periodFromVnCalendarDate(date);
}

/** Cộng tháng trên lịch VN, giữ ngày (20/02 + 1 tháng → 20/03). */
export function addMonthsPreserveDayUtc(start: Date, months: number): Date {
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

/**
 * Khoảng từng đợt NT: bắt đầu từ ngày ký HĐ, mỗi chu kỳ +N tháng.
 * Vd. BĐ 20/01, tháng: đợt 1 = 20/01→19/02, đợt 2 = 20/02→19/03.
 * Kỳ YYYY-MM = tháng của ngày kết thúc đợt.
 */
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

    const period = periodFromVnCalendarDate(periodEndDate);
    out.push({
      batchSequence: i + 1,
      period,
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

/** Cửa sổ lưu revenue plan — HĐ 3 tháng/đợt → mỗi đợt có N dòng KH tháng (N = chu kỳ). */
export function generateRevenuePlanWindowsFromContract(input: {
  startDate: Date;
  durationYears: number;
  billingCycle: BillingCycle;
  endDate?: Date | null;
}): AcceptanceBatchWindow[] {
  const batches = generateAcceptanceBatchWindows(input);
  const interval = billingCycleToIntervalMonths(input.billingCycle);
  if (interval == null || interval <= 1) {
    return batches;
  }
  return batches.flatMap((w) =>
    splitBatchWindowIntoMonthlySlices(w, interval),
  );
}

export function derivePeriodFromEndDate(end: Date): string {
  return periodFromUtcDate(end);
}
