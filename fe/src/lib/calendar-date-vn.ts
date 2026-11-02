/** Lịch VN (UTC+7) — khớp formatDate (date-fns local) trên FE. */
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

export function calendarYmdInVn(d: Date): {
  year: number;
  month: number;
  day: number;
} {
  const shifted = new Date(d.getTime() + VN_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

export function utcDateFromVnYmd(
  year: number,
  month: number,
  day: number,
): Date {
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}

export function normalizeContractCalendarDate(d: Date): Date {
  const { year, month, day } = calendarYmdInVn(d);
  return utcDateFromVnYmd(year, month, day);
}

export function endOfVnCalendarDay(d: Date): Date {
  const { year, month, day } = calendarYmdInVn(d);
  return new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
}

export function periodFromVnCalendarDate(d: Date): string {
  const { year, month } = calendarYmdInVn(d);
  return `${year}-${String(month).padStart(2, '0')}`;
}
