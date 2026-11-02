'use client';

import type { PeriodComparison } from '@/lib/types';
import {
  formatSubBatchLabel,
  type RevenuePlanBatchGroup,
} from '@/lib/revenue-plan-batch-groups';
import { formatPlanBatchDateRange } from '@/components/shared/plan-batch-date-range';
import { formatCurrencyVND } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { ConfirmDeleteButton } from '@/components/shared/confirm-delete-button';
import { WriteOnly } from '@/components/auth/auth-provider';

function VarianceCell({ value }: { value: string }) {
  const n = Number(value);
  const negative = !Number.isNaN(n) && n < 0;
  return (
    <span className={negative ? 'text-red-600' : 'text-emerald-700'}>
      {formatCurrencyVND(value)}
    </span>
  );
}

export function RevenuePlanBatchList({
  groups,
  selectedPlanIds,
  onTogglePlan,
  onEdit,
  onDelete,
}: {
  groups: RevenuePlanBatchGroup[];
  selectedPlanIds: Set<string>;
  onTogglePlan: (id: string, checked: boolean) => void;
  onEdit: (row: PeriodComparison) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white text-sm">
      {groups.map((group) => (
        <li key={`batch-${group.batchSequence}`}>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 bg-slate-50/90 px-3 py-2.5 sm:flex-nowrap sm:px-4">
            <p className="min-w-[72px] font-semibold text-slate-900">
              Đợt {group.batchSequence}
            </p>
            <p className="min-w-0 flex-1 text-xs text-slate-600">
              {formatPlanBatchDateRange(
                group.batchPeriodStartDate,
                group.batchPeriodEndDate,
              )}
            </p>
            <p className="shrink-0 text-xs text-slate-500">
              KH đợt{' '}
              <span className="font-medium tabular-nums text-slate-900">
                {formatCurrencyVND(group.plannedTotal)}
              </span>
            </p>
            <p className="shrink-0 text-xs text-slate-500">
              NT{' '}
              <span className="font-medium tabular-nums text-slate-900">
                {formatCurrencyVND(group.actualTotal)}
              </span>
            </p>
            <p className="shrink-0 text-xs text-slate-500">
              Chênh <VarianceCell value={group.varianceTotal} />
            </p>
          </div>
          <ul className="border-t border-slate-100">
            {group.slices.map((row, sliceIdx) => (
              <li
                key={row.revenuePlanId!}
                className="flex items-center gap-2 border-b border-slate-50 px-2 py-2 last:border-b-0 sm:gap-3 sm:px-4"
              >
                <input
                  type="checkbox"
                  checked={selectedPlanIds.has(row.revenuePlanId!)}
                  onChange={(e) =>
                    onTogglePlan(row.revenuePlanId!, e.target.checked)
                  }
                  aria-label={formatSubBatchLabel(
                    group.batchSequence,
                    sliceIdx + 1,
                  )}
                  className="shrink-0 rounded border-slate-300"
                />
                <div className="min-w-0 flex-1 truncate border-l-2 border-teal-200 pl-2 sm:pl-3">
                  <span className="font-medium text-slate-800">
                    {formatSubBatchLabel(group.batchSequence, sliceIdx + 1)}
                  </span>
                  <span className="mx-1.5 text-slate-300">·</span>
                  <span className="text-xs text-slate-500">
                    {formatPlanBatchDateRange(
                      row.periodStartDate,
                      row.periodEndDate,
                    )}
                  </span>
                </div>
                <span className="shrink-0 tabular-nums font-medium text-slate-900 sm:hidden">
                  {formatCurrencyVND(row.plannedAmount)}
                </span>
                <span className="hidden w-[7.5rem] shrink-0 text-right tabular-nums font-medium sm:inline">
                  {formatCurrencyVND(row.plannedAmount)}
                </span>
                <span className="hidden w-[7.5rem] shrink-0 text-right tabular-nums text-slate-700 sm:inline">
                  {formatCurrencyVND(row.actualAmount ?? '0')}
                </span>
                <span className="hidden w-[6.5rem] shrink-0 text-right sm:inline">
                  <VarianceCell value={row.variance} />
                </span>
                <div className="flex shrink-0 items-center gap-1">
                  <WriteOnly>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-8 px-2.5"
                      onClick={() => onEdit(row)}
                    >
                      Sửa
                    </Button>
                  </WriteOnly>
                  <ConfirmDeleteButton
                    onConfirm={() => onDelete(row.revenuePlanId!)}
                    title="Xóa kế hoạch tháng?"
                    description={`Xóa ${formatSubBatchLabel(group.batchSequence, sliceIdx + 1)} (${formatPlanBatchDateRange(row.periodStartDate, row.periodEndDate)}).`}
                  />
                </div>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}
