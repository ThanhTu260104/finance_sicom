import type { BillingCycle } from '@/lib/types';
import { billingCycleLabel } from '@/components/shared/status-badges';
import { formatDate } from '@/lib/format';

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

export function formatContractDurationLine(input: {
  durationYears?: number | null;
  billingCycle?: BillingCycle;
}) {
  const parts: string[] = [];
  if (input.durationYears != null && input.durationYears > 0) {
    parts.push(`Thời hạn: ${input.durationYears} năm`);
  }
  if (input.billingCycle) {
    parts.push(`Chu kỳ NT: ${billingCycleLabel[input.billingCycle]}`);
  }
  return parts.length > 0
    ? parts.join(' · ')
    : 'Nhập thời hạn (năm) và chu kỳ nghiệm thu trên HĐ';
}

/** Khoảng thời gian HĐ cho dashboard (ngày bắt đầu – ngày kết thúc). */
export function formatContractPeriodRange(input: {
  startDate?: string | null;
  endDate?: string | null;
}): string | null {
  const start = formatDate(input.startDate);
  const end = formatDate(input.endDate);
  if (start === '—' && end === '—') return null;
  if (start !== '—' && end !== '—') return `${start} – ${end}`;
  if (start !== '—') return `${start} – …`;
  return `… – ${end}`;
}
