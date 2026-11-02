'use client';

import { formatDate } from '@/lib/format';

export function formatPlanBatchDateRange(
  start?: string | null,
  end?: string | null,
) {
  if (!start && !end) return '—';
  if (start && end) {
    return `${formatDate(start)} → ${formatDate(end)}`;
  }
  return formatDate(start ?? end);
}

export function PlanBatchDateRange({
  batchSequence,
  periodStartDate,
  periodEndDate,
}: {
  batchSequence?: number | null;
  periodStartDate?: string | null;
  periodEndDate?: string | null;
}) {
  const round =
    batchSequence != null && batchSequence > 0
      ? `Đợt ${batchSequence}`
      : '—';
  return (
    <div className="leading-tight">
      <span className="font-medium text-slate-900">{round}</span>
      <p className="text-xs text-slate-500">
        {formatPlanBatchDateRange(periodStartDate, periodEndDate)}
      </p>
    </div>
  );
}
