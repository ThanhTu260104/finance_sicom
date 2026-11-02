import { periodFromVnCalendarDate } from './calendar-date-vn.util';

/** Kỳ hiển thị trên biểu đồ / KPI theo ngày thu thực tế. */
export function collectionOccurrencePeriod(input: {
  collectionDate?: Date | null;
  period: string;
}): string {
  if (input.collectionDate && !Number.isNaN(input.collectionDate.getTime())) {
    return periodFromVnCalendarDate(input.collectionDate);
  }
  return input.period;
}
