'use client';

import { formatCurrencyCompactVND, formatCurrencyVND } from '@/lib/format';
import { cn } from '@/lib/utils';

export function MoneyKpiCard({
  label,
  value,
  fullValue,
  sub,
  className,
}: {
  label: string;
  value: string;
  fullValue?: string;
  sub?: string;
  className?: string;
}) {
  const display = formatCurrencyCompactVND(value);
  const tooltip = fullValue ?? formatCurrencyVND(value);

  return (
    <div
      className={cn(
        'rounded-lg border border-slate-200 bg-white px-4 py-3',
        className,
      )}
      title={tooltip}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-slate-900">
        {display}
      </p>
      {sub ? <p className="mt-1 text-xs text-slate-500">{sub}</p> : null}
    </div>
  );
}

export function CountKpiCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-slate-900">
        {value}
      </p>
      {sub ? <p className="mt-1 text-xs text-slate-500">{sub}</p> : null}
    </div>
  );
}
