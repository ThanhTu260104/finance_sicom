'use client';

import {
  formatSubBatchLabel,
  type PlanDraftBatchGroup,
} from '@/lib/revenue-plan-batch-groups';
import { formatPlanBatchDateRange } from '@/components/shared/plan-batch-date-range';
import { formatCurrencyVND, formatPeriod } from '@/lib/format';

export function RevenuePlanGeneratePreview({
  groups,
  total,
  contractValue,
  flatMonthly = false,
}: {
  groups: PlanDraftBatchGroup[];
  total: string;
  contractValue: string;
  flatMonthly?: boolean;
}) {
  const totalNum = Number(total);
  const contractNum = Number(contractValue);
  const totalMatches =
    !Number.isNaN(totalNum) &&
    !Number.isNaN(contractNum) &&
    Math.abs(totalNum - contractNum) < 0.01;

  return (
    <div className="space-y-2">
      <ul className="max-h-56 divide-y divide-slate-200 overflow-auto rounded-lg border border-slate-200 bg-white text-sm">
        {flatMonthly
          ? groups.flatMap((group) =>
              group.slices.map((row) => (
                <li
                  key={row.period}
                  className="flex items-center gap-2 px-3 py-2"
                >
                  <span className="min-w-0 flex-1 text-xs">
                    <span className="font-medium text-slate-800">
                      {formatPeriod(row.period)}
                    </span>
                  </span>
                  <span className="shrink-0 tabular-nums text-slate-900">
                    {formatCurrencyVND(row.plannedAmount)}
                  </span>
                </li>
              )),
            )
          : groups.map((group) => (
              <li key={`preview-batch-${group.batchSequence}`}>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 bg-slate-50/90 px-3 py-2">
                  <span className="font-semibold text-slate-900">
                    Đợt {group.batchSequence}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-xs text-slate-600">
                    {formatPlanBatchDateRange(
                      group.batchPeriodStartDate,
                      group.batchPeriodEndDate,
                    )}
                  </span>
                  <span className="shrink-0 text-xs font-medium tabular-nums text-teal-800">
                    {formatCurrencyVND(group.plannedTotal)}
                  </span>
                </div>
                <ul>
                  {group.slices.map((row, sliceIdx) => (
                    <li
                      key={`${group.batchSequence}-${row.period}`}
                      className="flex items-center gap-2 border-t border-slate-50 px-3 py-1.5 pl-4"
                    >
                      <span className="min-w-0 flex-1 truncate border-l-2 border-teal-200 pl-2 text-xs">
                        <span className="font-medium text-slate-800">
                          {formatSubBatchLabel(
                            group.batchSequence,
                            sliceIdx + 1,
                          )}
                        </span>
                        <span className="mx-1 text-slate-300">·</span>
                        <span className="text-slate-500">
                          {formatPeriod(row.period)}
                        </span>
                      </span>
                      <span className="shrink-0 tabular-nums text-slate-900">
                        {formatCurrencyVND(row.plannedAmount)}
                      </span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
      </ul>
      <p className="text-xs text-slate-600">
        Tổng KH:{' '}
        <span className="font-medium tabular-nums text-slate-900">
          {formatCurrencyVND(total)}
        </span>
        {' · '}
        Giá trị HĐ:{' '}
        <span className="font-medium tabular-nums text-slate-900">
          {formatCurrencyVND(contractValue)}
        </span>
        {!totalMatches ? (
          <span className="text-amber-700"> — lệch giá trị HĐ, kiểm tra lại.</span>
        ) : null}
      </p>
    </div>
  );
}
