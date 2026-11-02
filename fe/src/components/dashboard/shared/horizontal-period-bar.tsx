'use client';

import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';

function clampPercent(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.min(Math.max(n, 0), 100);
}

/** Vị trí % trên thanh thời gian hợp đồng (0–100). */
export function computeTimePositionPercent(
  startIso: string | null | undefined,
  endIso: string | null | undefined,
  asOfIso: string,
): number {
  if (!startIso || !endIso) return 0;
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  const now = new Date(asOfIso).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  if (now <= start) return 0;
  if (now >= end) return 100;
  return ((now - start) / (end - start)) * 100;
}

export function HorizontalPeriodBar({
  startDate,
  endDate,
  asOf,
  markerLabel = 'Hiện tại',
  className,
}: {
  startDate: string | null | undefined;
  endDate: string | null | undefined;
  asOf: string;
  markerLabel?: string;
  className?: string;
}) {
  const marker = clampPercent(
    computeTimePositionPercent(startDate, endDate, asOf),
  );
  const hasRange = Boolean(startDate && endDate);

  return (
    <div className={cn('space-y-1', className)}>
      <div className="relative h-2 rounded-full bg-slate-100">
        {hasRange ? (
          <>
            <div className="absolute inset-y-0 left-0 w-full rounded-full bg-slate-300/80" />
            <div
              className="absolute top-1/2 h-3 w-0.5 -translate-y-1/2 bg-slate-900"
              style={{ left: `${marker}%` }}
              title={markerLabel}
            />
          </>
        ) : null}
      </div>
      <div className="flex justify-between text-[10px] text-slate-500">
        <span>{formatDate(startDate)}</span>
        <span className="font-medium text-slate-700">{markerLabel}</span>
        <span>{formatDate(endDate)}</span>
      </div>
    </div>
  );
}
