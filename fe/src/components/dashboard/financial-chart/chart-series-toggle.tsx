'use client';

import { cn } from '@/lib/utils';

export type ChartSeriesToggleItem = {
  key: string;
  label: string;
  color: string;
};

export function ChartSeriesToggle({
  series,
  hiddenKeys,
  onToggle,
}: {
  series: ChartSeriesToggleItem[];
  hiddenKeys: Set<string>;
  onToggle: (key: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {series.map((s) => {
        const on = !hiddenKeys.has(s.key);
        return (
          <button
            key={s.key}
            type="button"
            onClick={() => onToggle(s.key)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
              on
                ? 'border-slate-300 bg-white text-slate-800 shadow-sm'
                : 'border-slate-200 bg-slate-100 text-slate-400 line-through',
            )}
          >
            <span
              className={cn('h-2 w-2 rounded-full', !on && 'opacity-40')}
              style={{ backgroundColor: s.color }}
            />
            {s.label}
          </button>
        );
      })}
    </div>
  );
}
