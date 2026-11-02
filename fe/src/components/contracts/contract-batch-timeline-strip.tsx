'use client';

import { useMemo } from 'react';
import type { BillingCycle, TimelineStatus } from '@/lib/types';
import type { BatchPeriodSource } from '@/lib/plan-batch-period-map';
import { formatPeriod } from '@/lib/format';
import { cn } from '@/lib/utils';
import {
  BATCH_BAND_BG_CLASS,
  batchLabel,
  buildPeriodBatchDecorations,
  formatBatchDateRange,
  groupPeriodsByBatch,
  isMultiMonthAcceptanceCycle,
} from '@/lib/plan-batch-period-map';

export function ContractBatchTimelineStrip({
  periods,
  points,
  billingCycle,
  timelineStatusByPeriod,
}: {
  periods: string[];
  points: BatchPeriodSource[];
  billingCycle?: BillingCycle;
  /** Dashboard HĐ: PAST / CURRENT / FUTURE theo kỳ hiện tại */
  timelineStatusByPeriod?: Map<string, TimelineStatus>;
}) {
  const decorations = useMemo(
    () => buildPeriodBatchDecorations(periods, points, billingCycle),
    [periods, points, billingCycle],
  );
  const multiMonth = useMemo(
    () => isMultiMonthAcceptanceCycle(billingCycle, decorations, periods),
    [billingCycle, decorations, periods],
  );
  const groups = useMemo(
    () => groupPeriodsByBatch(periods, decorations),
    [periods, decorations],
  );
  const statusFor = (period: string): TimelineStatus | undefined =>
    timelineStatusByPeriod?.get(period);

  if (periods.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-500">
        {multiMonth
          ? 'Các tháng cùng màu nền thuộc một đợt nghiệm thu (theo từ ngày → đến ngày trên kế hoạch).'
          : 'Mỗi tháng tương ứng một đợt nghiệm thu.'}
      </p>
      <div className="flex min-w-0 flex-wrap items-stretch gap-1.5">
        {groups.map((group) => {
          if (group.batchSequence < 0) {
            return group.periods.map((period) => {
              const timelineStatus = statusFor(period);
              return (
                <span
                  key={period}
                  className={cn(
                    'rounded-md px-2 py-1 text-sm',
                    timelineStatus === 'CURRENT' &&
                      'bg-slate-200 font-semibold',
                    timelineStatus === 'PAST' && 'bg-slate-100',
                    timelineStatus === 'FUTURE' &&
                      'border border-dashed border-slate-200 bg-white',
                  )}
                >
                  {formatPeriod(period)}
                </span>
              );
            });
          }

          const bandClass =
            BATCH_BAND_BG_CLASS[group.bandIndex % BATCH_BAND_BG_CLASS.length];
          const rangeLabel = formatBatchDateRange(
            group.periodStartDate,
            group.periodEndDate,
          );
          const showGroupHeader = multiMonth && group.periods.length > 1;

          return (
            <div
              key={`${group.batchSequence}-${group.periods[0]}`}
              className={cn(
                'rounded-md border border-slate-200/70 px-1.5 py-1',
                bandClass,
              )}
            >
              {showGroupHeader ? (
                <div className="mb-0.5 text-center text-[10px] font-semibold leading-tight text-slate-700">
                  {batchLabel(group.batchSequence)}
                  {rangeLabel ? (
                    <span className="block font-normal text-slate-500">
                      {rangeLabel}
                    </span>
                  ) : null}
                </div>
              ) : null}
              <div className="flex flex-wrap justify-center gap-0.5">
                {group.periods.map((period) => {
                  const timelineStatus = statusFor(period);
                  return (
                    <span
                      key={period}
                      className={cn(
                        'rounded px-1.5 py-0.5 text-xs sm:text-sm',
                        timelineStatus === 'CURRENT' &&
                          'bg-white/80 font-semibold ring-1 ring-slate-300',
                        timelineStatus === 'PAST' && 'text-slate-800',
                        timelineStatus === 'FUTURE' && 'text-slate-500',
                      )}
                    >
                      {formatPeriod(period)}
                    </span>
                  );
                })}
              </div>
              {!showGroupHeader && group.batchSequence > 0 ? (
                <div className="mt-0.5 text-center text-[10px] font-medium text-slate-600">
                  {batchLabel(group.batchSequence)}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
