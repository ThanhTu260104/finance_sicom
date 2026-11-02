'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { pieColorForKey } from '@/lib/chart-colors';
import { formatCurrencyVND, formatPercentDisplay } from '@/lib/format';
import { parseChartAmount } from './chart-utils';
import { FinancialTooltip } from './financial-tooltip';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type CompositionRow = {
  id: string;
  label: string;
  href?: string;
  contractValue: string;
  value: string;
  percent: string;
};

export function FinancialCompositionChart({
  title,
  rows,
}: {
  title: string;
  rows: CompositionRow[];
}) {
  const [chartType, setChartType] = useState<'pie' | 'donut'>('donut');
  const [hoverId, setHoverId] = useState<string | null>(null);

  const filtered = useMemo(
    () => rows.filter((r) => parseChartAmount(r.value) > 0),
    [rows],
  );

  if (filtered.length === 0) {
    return <p className="text-sm text-slate-500">Chưa có dữ liệu thu tiền.</p>;
  }

  const total = filtered.reduce((s, r) => s + parseChartAmount(r.value), 0);
  const active = hoverId
    ? filtered.find((r) => r.id === hoverId)
    : undefined;

  let angle = 0;
  const cx = 120;
  const cy = 120;
  const r = 90;
  const ir = chartType === 'donut' ? 48 : 0;

  const slices = filtered.map((row, i) => {
    const v = parseChartAmount(row.value);
    const sweep = total > 0 ? (v / total) * 360 : 0;
    const start = angle;
    angle += sweep;
    return { row, start, sweep, color: pieColorForKey(row.id, i) };
  });

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        <div className="flex gap-1">
          {(['donut', 'pie'] as const).map((t) => (
            <Button
              key={t}
              type="button"
              size="sm"
              variant={chartType === t ? 'default' : 'outline'}
              className={cn('h-8 text-xs')}
              onClick={() => setChartType(t)}
            >
              {t === 'donut' ? 'Donut' : 'Pie'}
            </Button>
          ))}
        </div>
      </div>
      <div className="relative flex flex-wrap gap-6">
        {hoverId && active ? (
          <div className="pointer-events-none absolute left-56 top-0 z-10 max-w-[260px]">
            <FinancialTooltip
              variant="floating"
              data={{
                title: active.label,
                totalContractValue: active.contractValue,
                actualCollection: active.value,
                collectionProgress: active.percent,
              }}
            />
          </div>
        ) : null}
        <svg viewBox="0 0 240 240" className="h-56 w-56 shrink-0">
          {slices.map(({ row, start, sweep, color }) => (
            <path
              key={row.id}
              d={arcPath(cx, cy, r, ir, start, start + sweep)}
              fill={color}
              opacity={hoverId && hoverId !== row.id ? 0.45 : 1}
              onMouseEnter={() => setHoverId(row.id)}
              onMouseLeave={() => setHoverId(null)}
            />
          ))}
        </svg>
        <ul className="min-w-[200px] flex-1 space-y-1 text-xs text-slate-700">
          {slices.map(({ row, color }) => (
            <li key={row.id} className="flex items-center gap-2">
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: color }}
              />
              {row.href ? (
                <Link href={row.href} className="hover:underline">
                  {row.label}
                </Link>
              ) : (
                row.label
              )}
              <span className="ml-auto tabular-nums">
                {formatPercentDisplay(row.percent)}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <p className="text-xs text-slate-500">
        Tổng thu (phạm vi lọc): {formatCurrencyVND(String(total))}
      </p>
    </div>
  );
}

function polar(cx: number, cy: number, rad: number, deg: number) {
  const a = ((deg - 90) * Math.PI) / 180;
  return { x: cx + rad * Math.cos(a), y: cy + rad * Math.sin(a) };
}

function arcPath(
  cx: number,
  cy: number,
  r: number,
  ir: number,
  start: number,
  end: number,
) {
  if (end - start >= 360) end = start + 359.99;
  const p0 = polar(cx, cy, r, end);
  const p1 = polar(cx, cy, r, start);
  const large = end - start > 180 ? 1 : 0;
  if (ir <= 0) {
    return `M ${cx} ${cy} L ${p1.x} ${p1.y} A ${r} ${r} 0 ${large} 0 ${p0.x} ${p0.y} Z`;
  }
  const p2 = polar(cx, cy, ir, start);
  const p3 = polar(cx, cy, ir, end);
  return `M ${p1.x} ${p1.y} A ${r} ${r} 0 ${large} 1 ${p0.x} ${p0.y} L ${p3.x} ${p3.y} A ${ir} ${ir} 0 ${large} 0 ${p2.x} ${p2.y} Z`;
}
