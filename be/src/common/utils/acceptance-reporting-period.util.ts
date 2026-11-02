import { periodFromVnCalendarDate } from './calendar-date-vn.util';

/** Kỳ hiển thị trên biểu đồ / KPI theo thời điểm NT thực tế. */
export function acceptanceOccurrencePeriod(input: {
  acceptanceDate?: Date | null;
  invoiceDate?: Date | null;
  period: string;
}): string {
  if (input.acceptanceDate && !Number.isNaN(input.acceptanceDate.getTime())) {
    return periodFromVnCalendarDate(input.acceptanceDate);
  }
  if (input.invoiceDate && !Number.isNaN(input.invoiceDate.getTime())) {
    return periodFromVnCalendarDate(input.invoiceDate);
  }
  return input.period;
}
