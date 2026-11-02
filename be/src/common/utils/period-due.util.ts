import { PERIOD_REGEX } from '../constants/period';

/** Cuối ngày cuối cùng của kỳ YYYY-MM (UTC). */
export function endOfPeriod(period: string): Date | null {
  if (!PERIOD_REGEX.test(period)) return null;
  const year = Number(period.slice(0, 4));
  const month = Number(period.slice(5, 7));
  return new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
}

/** Cuối ngày theo lịch (UTC). */
export function endOfCalendarDay(value: Date): Date {
  return new Date(
    Date.UTC(
      value.getUTCFullYear(),
      value.getUTCMonth(),
      value.getUTCDate(),
      23,
      59,
      59,
      999,
    ),
  );
}

export function isPastDue(dueEnd: Date, now: Date): boolean {
  return now.getTime() > dueEnd.getTime();
}
