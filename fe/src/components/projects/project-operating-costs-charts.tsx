'use client';

import { useMemo } from 'react';
import {
  axisMoneyLabel,
  chartMax,
  parseChartAmount,
} from '@/components/dashboard/financial-chart/chart-utils';
import {
  fillCalendarYearPoints,
  parseYearFromPeriod,
} from '@/lib/operating-cost-year-series';
import { formatCurrencyCompactVND, formatCurrencyVND, formatPeriod } from '@/lib/format';
import { parseCostAmount } from '@/lib/project-operating-cost-totals';
import type {
  OperatingCostTrendPoint,
  ProjectOperatingCost,
} from '@/lib/types';
import { cn } from '@/lib/utils';

const CATEGORY_COLORS = [
  '#0f766e',
  '#0369a1',
  '#7c3aed',
  '#c2410c',
  '#b45309',
  '#be123c',
  '#4d7c0f',
  '#64748b',
  '#0891b2',
  '#9333ea',
];

type CategorySlice = {
  categoryId: string;
  code: string;
  name: string;
  amount: number;
  color: string;
};

function aggregateByCategory(items: ProjectOperatingCost[]): CategorySlice[] {
  const map = new Map<string, CategorySlice>();
  let colorIdx = 0;
  for (const row of items) {
    const amount = parseCostAmount(row.amount);
    const key = row.categoryId;
    let slice = map.get(key);
    if (!slice) {
      slice = {
        categoryId: key,
        code: row.category?.code ?? '—',
        name: row.category?.name ?? 'Khác',
        amount: 0,
        color: CATEGORY_COLORS[colorIdx % CATEGORY_COLORS.length]!,
      };
      colorIdx += 1;
      map.set(key, slice);
    }
    slice.amount += amount;
  }
  return Array.from(map.values()).sort((a, b) => b.amount - a.amount);
}

const MONTH_SHORT = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12'];

/** Rút gọn nhãn trên cột: 256,5 tr · 1,2 tỷ */
function columnMoneyLabel(amount: number) {
  if (amount <= 0) return '';
  return formatCurrencyCompactVND(String(Math.round(amount)));
}

function MonthlyTrendChart({
  yearPoints,
  selectedPeriod,
  onSelectPeriod,
  year,
}: {
  yearPoints: OperatingCostTrendPoint[];
  selectedPeriod: string;
  onSelectPeriod: (period: string) => void;
  year: number;
}) {
  const max = useMemo(() => {
    const values = yearPoints.map((p) => parseChartAmount(p.total));
    return chartMax(values);
  }, [yearPoints]);

  const scaleHint = max > 0 ? axisMoneyLabel(max) : '';

  return (
    <div className="w-full">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-xs text-slate-500">
          Năm {year} · bấm cột để xem chi tiết tháng
        </span>
        {scaleHint ? (
          <span className="text-[10px] text-slate-400">
            Max cột: {scaleHint}
          </span>
        ) : null}
      </div>

      <div
        className="grid w-full grid-cols-12 gap-1 sm:gap-1.5"
        role="img"
        aria-label={`Chi phí 12 tháng năm ${year}`}
      >
        {yearPoints.map((p, i) => {
          const v = parseChartAmount(p.total);
          const hasData = v > 0;
          const active = p.period === selectedPeriod;
          const heightPct =
            max > 0 && hasData ? Math.max((v / max) * 100, 12) : 0;

          return (
            <button
              key={p.period}
              type="button"
              title={
                hasData
                  ? `${formatPeriod(p.period)}: ${formatCurrencyVND(v)}`
                  : `${formatPeriod(p.period)}: chưa có chi phí`
              }
              onClick={() => onSelectPeriod(p.period)}
              className={cn(
                'flex min-w-0 flex-col rounded-md border border-transparent px-0.5 py-1.5 transition-colors',
                'hover:border-slate-200 hover:bg-slate-50/80',
                active && 'border-slate-300 bg-slate-50 ring-1 ring-slate-800/80',
              )}
            >
              <span
                className={cn(
                  'mb-1.5 flex min-h-[2.5rem] items-end justify-center px-0.5 text-center leading-snug',
                  'text-[10px] tabular-nums sm:text-[11px]',
                  hasData
                    ? 'font-semibold text-slate-800'
                    : 'font-normal text-slate-300',
                )}
              >
                {hasData ? (
                  <span className="break-words [overflow-wrap:anywhere]">
                    {columnMoneyLabel(v)}
                  </span>
                ) : (
                  '—'
                )}
              </span>

              <div className="flex h-20 items-end justify-center sm:h-24">
                <div
                  className={cn(
                    'w-full max-w-[2.75rem] rounded-sm transition-all sm:max-w-none',
                    hasData
                      ? active
                        ? 'bg-slate-800'
                        : 'bg-teal-600 hover:bg-teal-700'
                      : 'h-0.5 w-3 rounded-full bg-slate-200',
                  )}
                  style={
                    hasData
                      ? { height: `${heightPct}%`, minHeight: '0.5rem' }
                      : undefined
                  }
                />
              </div>

              <span
                className={cn(
                  'mt-2 text-center text-[10px] font-medium sm:text-xs',
                  active ? 'text-slate-900' : 'text-slate-500',
                )}
              >
                {MONTH_SHORT[i]}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MonthlyTrendLineChart({
  yearPoints,
  selectedPeriod,
  onSelectPeriod,
  year,
}: {
  yearPoints: OperatingCostTrendPoint[];
  selectedPeriod: string;
  onSelectPeriod: (period: string) => void;
  year: number;
}) {
  const layout = useMemo(() => {
    const values = yearPoints.map((p) => parseChartAmount(p.total));
    const max = chartMax(values);
    const w = 800;
    const h = 132;
    const pad = { l: 52, r: 20, t: 12, b: 30 };
    const innerW = w - pad.l - pad.r;
    const innerH = h - pad.t - pad.b;
    const n = values.length;
    const step = n > 1 ? innerW / (n - 1) : 0;

    const points = values.map((v, i) => {
      const x = pad.l + i * step;
      const ratio = max > 0 ? v / max : 0;
      const y = pad.t + innerH - ratio * innerH;
      return {
        x,
        y,
        v,
        period: yearPoints[i]!.period,
        hasData: v > 0,
      };
    });

    const linePath = points
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
      .join(' ');

    const baseY = pad.t + innerH;
    const areaPath = `${linePath} L ${points[points.length - 1]!.x.toFixed(2)} ${baseY} L ${points[0]!.x.toFixed(2)} ${baseY} Z`;

    const yTicks = [0, 0.5, 1].map((t) => ({
      y: pad.t + innerH * (1 - t),
      label: axisMoneyLabel(max * t),
    }));

    return { w, h, pad, innerH, max, points, linePath, areaPath, yTicks };
  }, [yearPoints]);

  const hasAnyData = layout.points.some((p) => p.hasData);

  return (
    <div className="w-full border-t border-slate-100 pt-4">
      <p className="mb-2 text-xs font-medium text-slate-700">
        Xu hướng đường · năm {year}
      </p>
      {!hasAnyData ? (
        <p className="text-sm text-slate-500">Chưa có chi phí trong năm này.</p>
      ) : (
        <svg
          viewBox={`0 0 ${layout.w} ${layout.h}`}
          className="h-[8.5rem] w-full max-w-full"
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label={`Biểu đồ đường chi phí năm ${year}`}
        >
          <defs>
            <linearGradient id="costLineArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0d9488" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#0d9488" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {layout.yTicks.map((tick, i) => (
            <g key={i}>
              <line
                x1={layout.pad.l}
                x2={layout.w - layout.pad.r}
                y1={tick.y}
                y2={tick.y}
                stroke="#f1f5f9"
                strokeWidth={1}
              />
              <text
                x={layout.pad.l - 6}
                y={tick.y + 3}
                textAnchor="end"
                className="fill-slate-400 text-[9px]"
              >
                {tick.label}
              </text>
            </g>
          ))}

          <line
            x1={layout.pad.l}
            x2={layout.w - layout.pad.r}
            y1={layout.pad.t + layout.innerH}
            y2={layout.pad.t + layout.innerH}
            stroke="#cbd5e1"
            strokeWidth={1}
          />

          <path d={layout.areaPath} fill="url(#costLineArea)" />
          <path
            d={layout.linePath}
            fill="none"
            stroke="#0f766e"
            strokeWidth={2.25}
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {layout.points.map((p, i) => {
            const active = p.period === selectedPeriod;
            return (
              <g
                key={p.period}
                className="cursor-pointer"
                onClick={() => onSelectPeriod(p.period)}
              >
                <title>
                  {p.hasData
                    ? `${formatPeriod(p.period)}: ${formatCurrencyVND(p.v)}`
                    : `${formatPeriod(p.period)}: 0 ₫`}
                </title>
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={active ? 6 : p.hasData ? 4.5 : 3}
                  className={cn(
                    'transition-all',
                    active
                      ? 'fill-slate-900 stroke-white stroke-[2]'
                      : p.hasData
                        ? 'fill-teal-600 stroke-white stroke-[1.5] hover:fill-teal-700'
                        : 'fill-slate-300 stroke-white stroke-[1]',
                  )}
                />
                <text
                  x={p.x}
                  y={layout.h - 8}
                  textAnchor="middle"
                  className={cn(
                    'text-[9px]',
                    active ? 'fill-slate-900 font-semibold' : 'fill-slate-500',
                  )}
                >
                  {MONTH_SHORT[i]}
                </text>
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}

function CategoryMixChart({ slices, total }: { slices: CategorySlice[]; total: number }) {
  if (total <= 0 || slices.length === 0) {
    return (
      <p className="text-sm text-slate-500">Chưa có cơ cấu loại chi phí tháng này.</p>
    );
  }

  return (
    <div className="max-h-48 space-y-1.5 overflow-y-auto pr-1">
      {slices.map((s) => {
        const pct = total > 0 ? (s.amount / total) * 100 : 0;
        return (
          <div key={s.categoryId} className="space-y-0.5">
            <div className="flex items-baseline justify-between gap-2 text-[11px]">
              <span className="truncate text-slate-800" title={s.name}>
                {s.name}
              </span>
              <span className="shrink-0 tabular-nums text-slate-600">
                {formatCurrencyCompactVND(String(s.amount))}
                <span className="text-slate-400"> · {pct.toFixed(0)}%</span>
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.min(pct, 100)}%`,
                  backgroundColor: s.color,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function ProjectOperatingCostsCharts({
  trendPoints,
  selectedPeriod,
  onSelectPeriod,
  monthItems,
  monthTotal,
  prevMonthTotal,
  yearTotal,
}: {
  trendPoints: OperatingCostTrendPoint[];
  selectedPeriod: string;
  onSelectPeriod: (period: string) => void;
  monthItems: ProjectOperatingCost[];
  monthTotal: number;
  prevMonthTotal: number | null;
  yearTotal: number;
}) {
  const year = parseYearFromPeriod(selectedPeriod);
  const yearPoints = useMemo(
    () => fillCalendarYearPoints(year, trendPoints),
    [year, trendPoints],
  );

  const monthsWithData = useMemo(
    () => yearPoints.filter((p) => parseChartAmount(p.total) > 0).length,
    [yearPoints],
  );

  const slices = useMemo(
    () => aggregateByCategory(monthItems),
    [monthItems],
  );

  const delta =
    prevMonthTotal != null && prevMonthTotal > 0
      ? ((monthTotal - prevMonthTotal) / prevMonthTotal) * 100
      : null;

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-3 md:p-4">
      <div className="grid gap-2 sm:grid-cols-3">
        <div className="rounded-md border border-slate-100 bg-slate-50/80 px-3 py-2">
          <p className="text-[10px] font-medium text-slate-500">
            Tháng {formatPeriod(selectedPeriod)}
          </p>
          <p className="text-base font-semibold tabular-nums text-slate-900">
            {formatCurrencyVND(monthTotal)}
          </p>
          <p className="text-[10px] text-slate-500">
            {monthItems.length} dòng · {slices.length} loại
          </p>
        </div>
        <div className="rounded-md border border-slate-100 bg-slate-50/80 px-3 py-2">
          <p className="text-[10px] font-medium text-slate-500">So tháng trước</p>
          <p className="text-base font-semibold tabular-nums">
            {delta == null ? (
              <span className="text-slate-400">—</span>
            ) : (
              <span
                className={cn(
                  delta > 0 ? 'text-amber-700' : delta < 0 ? 'text-teal-700' : 'text-slate-700',
                )}
              >
                {delta > 0 ? '+' : ''}
                {delta.toFixed(1)}%
              </span>
            )}
          </p>
          {prevMonthTotal != null && (
            <p className="text-[10px] text-slate-500">
              Kỳ trước: {formatCurrencyCompactVND(String(prevMonthTotal))}
            </p>
          )}
        </div>
        <div className="rounded-md border border-slate-100 bg-slate-50/80 px-3 py-2">
          <p className="text-[10px] font-medium text-slate-500">Cả năm {year}</p>
          <p className="text-base font-semibold tabular-nums text-slate-900">
            {formatCurrencyVND(yearTotal)}
          </p>
          <p className="text-[10px] text-slate-500">
            {monthsWithData}/12 tháng có phát sinh
          </p>
        </div>
      </div>

      <MonthlyTrendChart
        yearPoints={yearPoints}
        selectedPeriod={selectedPeriod}
        onSelectPeriod={onSelectPeriod}
        year={year}
      />

      <MonthlyTrendLineChart
        yearPoints={yearPoints}
        selectedPeriod={selectedPeriod}
        onSelectPeriod={onSelectPeriod}
        year={year}
      />

      <div className="border-t border-slate-100 pt-3">
        <h3 className="mb-2 text-xs font-semibold text-slate-700">
          Cơ cấu · {formatPeriod(selectedPeriod)}
        </h3>
        <CategoryMixChart slices={slices} total={monthTotal} />
      </div>
    </div>
  );
}
