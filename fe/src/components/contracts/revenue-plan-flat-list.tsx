'use client';

import type { PeriodComparison } from '@/lib/types';
import { PlanBatchDateRange } from '@/components/shared/plan-batch-date-range';
import { formatCurrencyVND, formatDate } from '@/lib/format';
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

export function RevenuePlanFlatList({
  rows,
  selectedPlanIds,
  onTogglePlan,
  onEdit,
  onDelete,
}: {
  rows: PeriodComparison[];
  selectedPlanIds: Set<string>;
  onTogglePlan: (id: string, checked: boolean) => void;
  onEdit: (row: PeriodComparison) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white text-sm">
      {rows.map((row) => (
        <li
          key={row.revenuePlanId!}
          className="flex flex-wrap items-center gap-2 px-3 py-2.5 sm:flex-nowrap sm:gap-3 sm:px-4"
        >
          <input
            type="checkbox"
            checked={selectedPlanIds.has(row.revenuePlanId!)}
            onChange={(e) =>
              onTogglePlan(row.revenuePlanId!, e.target.checked)
            }
            className="shrink-0 rounded border-slate-300"
          />
          <div className="min-w-0 flex-1">
            <PlanBatchDateRange
              batchSequence={row.batchSequence}
              periodStartDate={row.periodStartDate}
              periodEndDate={row.periodEndDate}
            />
          </div>
          <span className="hidden shrink-0 text-xs text-slate-600 sm:inline">
            {row.plannedAcceptanceDate
              ? formatDate(row.plannedAcceptanceDate)
              : '—'}
          </span>
          <span className="shrink-0 tabular-nums font-medium sm:w-[7.5rem] sm:text-right">
            {formatCurrencyVND(row.plannedAmount)}
          </span>
          <span className="hidden shrink-0 tabular-nums text-slate-700 sm:inline sm:w-[7.5rem] sm:text-right">
            {formatCurrencyVND(row.actualAmount ?? '0')}
          </span>
          <span className="hidden shrink-0 sm:inline sm:w-[6.5rem] sm:text-right">
            <VarianceCell value={row.variance} />
          </span>
          <div className="flex shrink-0 gap-1">
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
              title="Xóa kế hoạch?"
              description={`Xóa kế hoạch kỳ ${row.period}.`}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
