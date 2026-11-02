'use client';

import type { DashboardByProjectRow } from '@/lib/types';
import {
  compareDecimalStrings,
  formatCurrencyVND,
  formatPercentDisplay,
} from '@/lib/format';
import { cn } from '@/lib/utils';

export function ProjectPickerGrid({
  projects,
  selectedId,
  onSelect,
}: {
  projects: DashboardByProjectRow[];
  selectedId: string | null;
  onSelect: (projectId: string) => void;
}) {
  return (
    <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
      {projects.map((p) => {
        const active = selectedId === p.projectId;
        const behind = compareDecimalStrings(p.acceptanceGap, '0') > 0;

        return (
          <button
            key={p.projectId}
            type="button"
            onClick={() => onSelect(p.projectId)}
            className={cn(
              'flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors',
              active &&
                'border-slate-900 bg-slate-900 shadow-sm ring-1 ring-slate-900/20',
              !active &&
                behind &&
                'border-slate-200 border-l-[3px] border-l-amber-500 bg-amber-50/30 hover:bg-amber-50/60',
              !active &&
                !behind &&
                'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/80',
            )}
          >
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  'truncate font-mono text-[11px] font-bold leading-tight',
                  active ? 'text-white' : 'text-slate-900',
                )}
              >
                {p.projectCode}
              </p>
              <p
                className={cn(
                  'truncate text-[11px] leading-snug',
                  active ? 'text-slate-300' : 'text-slate-600',
                )}
                title={p.projectName}
              >
                {p.projectName}
              </p>
              <p
                className={cn(
                  'mt-0.5 text-[10px] leading-none',
                  active ? 'text-slate-500' : 'text-slate-400',
                )}
              >
                {p.contractCount} HĐ
              </p>
            </div>

            <div className="shrink-0 text-right leading-none">
              <p
                className={cn(
                  'text-[9px] font-semibold uppercase tracking-wider',
                  active ? 'text-slate-500' : 'text-slate-400',
                )}
              >
                Chênh NT
              </p>
              <p
                className={cn(
                  'mt-0.5 text-sm font-bold tabular-nums tracking-tight',
                  active && behind && 'text-amber-300',
                  active && !behind && 'text-emerald-300',
                  !active && behind && 'text-amber-800',
                  !active && !behind && 'text-emerald-700',
                )}
              >
                {behind
                  ? formatCurrencyVND(p.acceptanceGap)
                  : 'Đúng KH'}
              </p>
              <p
                className={cn(
                  'mt-1 text-[10px] tabular-nums',
                  active ? 'text-slate-500' : 'text-slate-400',
                )}
              >
                {formatPercentDisplay(p.acceptancePercent)} NT
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
