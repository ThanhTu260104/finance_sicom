'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { CHART_GREEN, CHART_SLATE } from '@/lib/chart-colors';
import { axisMoneyLabel, chartMax, parseChartAmount } from './chart-utils';
import {
  ComparisonChartTypeSelector,
  type ComparisonChartType,
} from './chart-type-selector';
import type { FinancialTooltipPayload } from './financial-tooltip';
import { ChartTooltipOverlay } from './chart-tooltip-overlay';

export type ComparisonRow = {
  id: string;
  label: string;
  subLabel?: string;
  href?: string;
  contractValue: string;
  plannedAcceptance: string;
  actualAcceptance: string;
  acceptanceGap: string;
  actualCollection: string;
  acceptancePercent: string;
  collectionPercent: string;
};

export function FinancialComparisonChart({
  title,
  rows,
  defaultChartType = 'horizontal-bar',
  sortBy = 'gap',
}: {
  title: string;
  rows: ComparisonRow[];
  defaultChartType?: ComparisonChartType;
  /** gap = ưu tiên dự án/HĐ đang lệch NT */
  sortBy?: 'gap' | 'planned';
}) {
  const [chartType, setChartType] = useState<ComparisonChartType>(defaultChartType);
  const [hoverId, setHoverId] = useState<string | null>(null);

  const sorted = useMemo(() => {
    const copy = [...rows];
    if (sortBy === 'gap') {
      copy.sort(
        (a, b) =>
          parseChartAmount(b.acceptanceGap) - parseChartAmount(a.acceptanceGap),
      );
    } else {
      copy.sort(
        (a, b) =>
          parseChartAmount(b.plannedAcceptance) -
          parseChartAmount(a.plannedAcceptance),
      );
    }
    return copy;
  }, [rows, sortBy]);

  if (sorted.length === 0) {
    return (
      <p className="text-sm text-slate-500">Chưa có dữ liệu cho {title}.</p>
    );
  }

  const active = hoverId
    ? sorted.find((r) => r.id === hoverId)
    : undefined;

  const maxVal = chartMax(
    sorted.flatMap((r) => [
      parseChartAmount(r.plannedAcceptance),
      parseChartAmount(r.actualAcceptance),
    ]),
  );

  const barHeight = 28;
  const gap = 12;
  const labelW = 200;
  const chartW = 520;
  const height =
    chartType === 'horizontal-bar' || chartType === 'stacked-bar'
      ? sorted.length * (barHeight * (chartType === 'stacked-bar' ? 1 : 2) + gap) +
        40
      : sorted.length * 48 + 80;

  const tooltip: FinancialTooltipPayload | null = active
    ? {
        title: active.label,
        totalContractValue: active.contractValue,
        plannedAcceptance: active.plannedAcceptance,
        actualAcceptance: active.actualAcceptance,
        acceptanceGap: active.acceptanceGap,
        actualCollection: active.actualCollection,
        acceptanceProgress: active.acceptancePercent,
        collectionProgress: active.collectionPercent,
      }
    : null;

  const activeRowIndex =
    hoverId != null ? sorted.findIndex((r) => r.id === hoverId) : -1;
  const tooltipTopPercent =
    activeRowIndex >= 0 &&
    (chartType === 'horizontal-bar' || chartType === 'stacked-bar')
      ? ((20 +
          activeRowIndex *
            (barHeight * (chartType === 'stacked-bar' ? 1 : 2) + gap)) /
          height) *
        100
      : 35;

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        <ComparisonChartTypeSelector value={chartType} onChange={setChartType} />
      </div>

      <div className="relative overflow-x-auto">
        {tooltip ? (
          <ChartTooltipOverlay
            data={tooltip}
            visible={hoverId !== null}
            leftPercent={62}
            top={Math.min(tooltipTopPercent, 75)}
          />
        ) : null}
        {chartType === 'horizontal-bar' || chartType === 'stacked-bar' ? (
          <svg
            viewBox={`0 0 ${labelW + chartW + 24} ${height}`}
            className="min-w-[640px] w-full"
            role="img"
            aria-label={title}
          >
            {sorted.map((row, i) => {
              const rowH =
                chartType === 'stacked-bar' ? barHeight + 4 : barHeight * 2 + 4;
              const y0 = 20 + i * (rowH + gap);
              const plannedW =
                (parseChartAmount(row.plannedAcceptance) / maxVal) * chartW;
              const actualW =
                (parseChartAmount(row.actualAcceptance) / maxVal) * chartW;
              const activeRow = hoverId === row.id;
              return (
                <g
                  key={row.id}
                  onMouseEnter={() => setHoverId(row.id)}
                  onMouseLeave={() => setHoverId(null)}
                  opacity={hoverId && !activeRow ? 0.55 : 1}
                >
                  <text
                    x={0}
                    y={y0 + barHeight - 4}
                    className="fill-slate-800 text-[11px] font-medium"
                  >
                    {truncate(row.label, 28)}
                  </text>
                  {chartType === 'stacked-bar' ? (
                    <>
                      <rect
                        x={labelW}
                        y={y0}
                        width={plannedW}
                        height={barHeight - 4}
                        fill={CHART_SLATE}
                        rx={2}
                      />
                      <rect
                        x={labelW}
                        y={y0}
                        width={actualW}
                        height={barHeight - 4}
                        fill={CHART_GREEN}
                        fillOpacity={0.92}
                        rx={2}
                      />
                    </>
                  ) : (
                    <>
                      <rect
                        x={labelW}
                        y={y0}
                        width={plannedW}
                        height={barHeight - 4}
                        fill={CHART_SLATE}
                        rx={2}
                      />
                      <rect
                        x={labelW}
                        y={y0 + barHeight}
                        width={actualW}
                        height={barHeight - 4}
                        fill={CHART_GREEN}
                        rx={2}
                      />
                    </>
                  )}
                </g>
              );
            })}
            <text x={labelW} y={height - 4} className="fill-slate-500 text-[10px]">
              {axisMoneyLabel(maxVal)} (max)
            </text>
          </svg>
        ) : (
          <GroupedColumnChart
            rows={sorted}
            maxVal={maxVal}
            chartType={chartType === 'grouped-bar' ? 'grouped-bar' : 'column'}
            hoverId={hoverId}
            onHover={setHoverId}
          />
        )}
      </div>

      <div className="flex flex-wrap gap-4 text-xs text-slate-600">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-[#475569]" /> Kế hoạch NT
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-[#16a34a]" /> NT thực tế
        </span>
      </div>

      <p className="text-xs text-slate-500">
        Di chuột lên từng hàng/cột để xem chi tiết trên biểu đồ.
      </p>

      {active?.href ? (
        <Link
          href={active.href}
          className="text-sm font-medium text-slate-700 underline-offset-2 hover:underline"
        >
          Xem chi tiết: {active.label}
        </Link>
      ) : null}
    </div>
  );
}

function GroupedColumnChart({
  rows,
  maxVal,
  chartType,
  hoverId,
  onHover,
}: {
  rows: ComparisonRow[];
  maxVal: number;
  chartType: 'column' | 'grouped-bar';
  hoverId: string | null;
  onHover: (id: string | null) => void;
}) {
  const width = 920;
  const height = 360;
  const pad = { top: 20, right: 16, bottom: 72, left: 48 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const groupW = innerW / Math.max(rows.length, 1);
  const barW = Math.min(22, groupW * 0.32);
  const baseY = pad.top + innerH;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="min-w-[720px] w-full">
      {rows.map((row, i) => {
        const cx = pad.left + i * groupW + groupW / 2;
        const plannedH =
          (parseChartAmount(row.plannedAcceptance) / maxVal) * innerH;
        const actualH =
          (parseChartAmount(row.actualAcceptance) / maxVal) * innerH;
        const active = hoverId === row.id;
        const grouped = chartType === 'grouped-bar';
        return (
          <g
            key={row.id}
            onMouseEnter={() => onHover(row.id)}
            onMouseLeave={() => onHover(null)}
            opacity={hoverId && !active ? 0.55 : 1}
          >
            <rect
              x={cx - (grouped ? barW + 2 : barW / 2)}
              y={baseY - plannedH}
              width={barW}
              height={plannedH}
              fill={CHART_SLATE}
            />
            <rect
              x={cx + (grouped ? 2 : barW / 2 + 2)}
              y={baseY - actualH}
              width={barW}
              height={actualH}
              fill={CHART_GREEN}
            />
            <text
              x={cx}
              y={height - 24}
              textAnchor="middle"
              transform={`rotate(-35 ${cx} ${height - 24})`}
              className="fill-slate-600 text-[9px]"
            >
              {truncate(row.label, 16)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function FinancialSingleMetricChart({
  title,
  rows,
  metricLabel = 'Thu tiền thực tế',
  defaultChartType = 'horizontal-bar',
}: {
  title: string;
  rows: Array<{
    id: string;
    label: string;
    href?: string;
    contractValue: string;
    value: string;
    percent: string;
  }>;
  metricLabel?: string;
  defaultChartType?: 'horizontal-bar' | 'column';
}) {
  const [chartType, setChartType] = useState(defaultChartType);
  const [hoverId, setHoverId] = useState<string | null>(null);

  const sorted = useMemo(
    () =>
      [...rows].sort(
        (a, b) => parseChartAmount(b.value) - parseChartAmount(a.value),
      ),
    [rows],
  );

  if (sorted.length === 0) {
    return <p className="text-sm text-slate-500">Chưa có dữ liệu.</p>;
  }

  const active = hoverId ? sorted.find((r) => r.id === hoverId) : undefined;
  const maxVal = chartMax(sorted.map((r) => parseChartAmount(r.value)));
  const labelW = 200;
  const chartW = 520;
  const barH = 22;
  const gap = 10;
  const height = sorted.length * (barH + gap) + 32;

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        <div className="flex gap-1">
          {(['horizontal-bar', 'column'] as const).map((t) => (
            <button
              key={t}
              type="button"
              className={`rounded-md border px-2 py-1 text-xs ${
                chartType === t
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-200 bg-white text-slate-700'
              }`}
              onClick={() => setChartType(t)}
            >
              {t === 'horizontal-bar' ? 'Cột ngang' : 'Cột'}
            </button>
          ))}
        </div>
      </div>

      <div className="relative">
        {active ? (
          <ChartTooltipOverlay
            data={{
              title: active.label,
              totalContractValue: active.contractValue,
              actualCollection: active.value,
              collectionProgress: active.percent,
            }}
            visible={hoverId !== null}
            leftPercent={65}
            top={24}
          />
        ) : null}
      {chartType === 'horizontal-bar' ? (
        <svg
          viewBox={`0 0 ${labelW + chartW + 16} ${height}`}
          className="min-w-[640px] w-full"
        >
          {sorted.map((row, i) => {
            const y = 16 + i * (barH + gap);
            const w = (parseChartAmount(row.value) / maxVal) * chartW;
            return (
              <g
                key={row.id}
                onMouseEnter={() => setHoverId(row.id)}
                onMouseLeave={() => setHoverId(null)}
              >
                <text x={0} y={y + barH - 6} className="fill-slate-800 text-[11px]">
                  {truncate(row.label, 28)}
                </text>
                <rect
                  x={labelW}
                  y={y}
                  width={w}
                  height={barH}
                  fill={CHART_GREEN}
                  rx={2}
                />
              </g>
            );
          })}
        </svg>
      ) : (
        <GroupedColumnChart
          rows={sorted.map((r) => ({
            id: r.id,
            label: r.label,
            contractValue: r.contractValue,
            plannedAcceptance: '0',
            actualAcceptance: r.value,
            acceptanceGap: '0',
            actualCollection: r.value,
            acceptancePercent: r.percent,
            collectionPercent: r.percent,
          }))}
          maxVal={maxVal}
          chartType="column"
          hoverId={hoverId}
          onHover={setHoverId}
        />
      )}
      </div>

      <p className="text-xs text-slate-500">{metricLabel}</p>
      {active?.href ? (
        <Link
          href={active.href}
          className="text-sm font-medium text-slate-700 underline-offset-2 hover:underline"
        >
          Drill-down: {active.label}
        </Link>
      ) : null}
    </div>
  );
}

function truncate(text: string, max: number) {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}
