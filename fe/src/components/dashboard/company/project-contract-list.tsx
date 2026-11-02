'use client';

import type { ProjectDashboardContractRow } from '@/lib/types';
import { cn } from '@/lib/utils';
import { compareDecimalStrings } from '@/lib/format';

export function ProjectContractList({
  contracts,
  selectedContractId,
  onSelect,
}: {
  contracts: ProjectDashboardContractRow[];
  selectedContractId: string | null;
  onSelect: (contractId: string) => void;
}) {
  const sorted = [...contracts].sort((a, b) =>
    a.contractNo.localeCompare(b.contractNo, 'vi'),
  );

  if (sorted.length === 0) {
    return (
      <p className="text-sm text-slate-500">Dự án chưa có hợp đồng.</p>
    );
  }

  return (
    <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
      {sorted.map((c) => {
        const active = selectedContractId === c.contractId;
        const behind = compareDecimalStrings(c.acceptanceGap, '0') > 0;
        return (
          <li key={c.contractId}>
            <button
              type="button"
              onClick={() => onSelect(c.contractId)}
              className={cn(
                'flex w-full items-baseline gap-3 px-4 py-3 text-left transition-colors',
                active
                  ? 'bg-slate-900 text-white'
                  : 'hover:bg-slate-50',
                behind && !active && 'bg-amber-50/50',
              )}
            >
              <span
                className={cn(
                  'shrink-0 font-mono text-sm font-semibold',
                  active ? 'text-white' : 'text-slate-900',
                )}
              >
                {c.contractNo}
              </span>
              <span
                className={cn(
                  'min-w-0 flex-1 truncate text-sm',
                  active ? 'text-slate-100' : 'text-slate-700',
                )}
              >
                {c.name}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
