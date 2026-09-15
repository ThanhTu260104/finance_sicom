'use client';

import { useMemo, useState } from 'react';
import { formatCurrencyVND, formatPeriod } from '@/lib/format';
import type {
  DashboardMonthlyPoint,
  DashboardProjectRow,
  DashboardStatusSlice,
} from '@/lib/types';
import { cn } from '@/lib/utils';

export type ChartType = 'bar' | 'line' | 'pie';

function parseAmount(value: string) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(n, 0) : 0;
}

/** High-contrast series for dark-on-light UI */
const SERIES = {
  planned: { color: '#1e293b', label: 'Kế hoạch' },
  accepted: { color: '#059669', label: 'Nghiệm thu' },
  collected: { color: '#2563eb', label: 'Thu tiền' },
} as const;

const PIE_COLORS = ['#059669', '#dc2626', '#ea580c', '#475569'];

type SelectedPoint = {
  period: string;
  planned: string;
  accepted: string;
  collected: string;
  series?: keyof typeof SERIES;
};

function DetailPanel({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ label: string; value: string; color?: string; raw?: boolean }>;
}) {
  return (
    <div className="rounded-lg border-2 border-slate-900/10 bg-slate-50 px-4 py-3">
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        {rows.map((row) => (
          <div key={row.label} className="rounded-md bg-white px-3 py-2 shadow-sm">
            <p className="inline-flex items-center gap-2 text-xs font-medium text-slate-500">
              {row.color ? (
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: row.color }}
                />
              ) : null}
              {row.label}
            </p>
            <p className="mt-0.5 text-sm font-semibold text-slate-900">
              {row.raw ? row.value : formatCurrencyVND(row.value)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DashboardTrendChart({
  type,
  data,
}: {
  type: Exclude<ChartType, 'pie'>;
  data: DashboardMonthlyPoint[];
}) {
  const [selected, setSelected] = useState<SelectedPoint | null>(null);

  if (data.length === 0) {
    return <p className="text-sm text-slate-500">Chưa có dữ liệu biểu đồ.</p>;
  }

  const width = 760;
  const height = 300;
  const padding = { top: 24, right: 16, bottom: 44, left: 16 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;
  const maxValue = Math.max(
    ...data.flatMap((d) => [
      parseAmount(d.planned),
      parseAmount(d.accepted),
      parseAmount(d.collected),
    ]),
    1,
  );

  const selectPeriod = (point: DashboardMonthlyPoint, series?: keyof typeof SERIES) => {
    setSelected({
      period: point.period,
      planned: point.planned,
      accepted: point.accepted,
      collected: point.collected,
      series,
    });
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">
        Bấm vào cột / điểm để xem số chi tiết
      </p>
      <div className="overflow-x-auto">
        {type === 'bar' ? (
          <BarChart
            data={data}
            width={width}
            height={height}
            padding={padding}
            innerWidth={innerWidth}
            innerHeight={innerHeight}
            maxValue={maxValue}
            selectedPeriod={selected?.period ?? null}
            onSelect={selectPeriod}
          />
        ) : (
          <LineChart
            data={data}
            width={width}
            height={height}
            padding={padding}
            innerWidth={innerWidth}
            innerHeight={innerHeight}
            maxValue={maxValue}
            selectedPeriod={selected?.period ?? null}
            onSelect={selectPeriod}
          />
        )}
      </div>
      <Legend />
      {selected ? (
        <DetailPanel
          title={`Tháng ${formatPeriod(selected.period)}${
            selected.series ? ` · ${SERIES[selected.series].label}` : ''
          }`}
          rows={[
            {
              label: 'Kế hoạch',
              value: selected.planned,
              color: SERIES.planned.color,
            },
            {
              label: 'Nghiệm thu',
              value: selected.accepted,
              color: SERIES.accepted.color,
            },
            {
              label: 'Thu tiền',
              value: selected.collected,
              color: SERIES.collected.color,
            },
          ]}
        />
      ) : (
        <p className="text-xs text-slate-400">Chưa chọn điểm nào trên biểu đồ.</p>
      )}
    </div>
  );
}

function BarChart({
  data,
  width,
  height,
  padding,
  innerWidth,
  innerHeight,
  maxValue,
  selectedPeriod,
  onSelect,
}: {
  data: DashboardMonthlyPoint[];
  width: number;
  height: number;
  padding: { top: number; right: number; bottom: number; left: number };
  innerWidth: number;
  innerHeight: number;
  maxValue: number;
  selectedPeriod: string | null;
  onSelect: (point: DashboardMonthlyPoint, series?: keyof typeof SERIES) => void;
}) {
  const groupWidth = innerWidth / data.length;
  const barWidth = Math.max(groupWidth / 4.2, 6);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full min-w-[640px]">
      {[0.25, 0.5, 0.75, 1].map((ratio) => {
        const y = padding.top + innerHeight * (1 - ratio);
        return (
          <line
            key={ratio}
            x1={padding.left}
            y1={y}
            x2={width - padding.right}
            y2={y}
            stroke="#e2e8f0"
            strokeDasharray="4 4"
          />
        );
      })}
      {data.map((point, index) => {
        const x0 = padding.left + index * groupWidth + groupWidth * 0.12;
        const active = selectedPeriod === point.period;
        const values: Array<{
          key: keyof typeof SERIES;
          value: number;
          raw: string;
        }> = [
          { key: 'planned', value: parseAmount(point.planned), raw: point.planned },
          { key: 'accepted', value: parseAmount(point.accepted), raw: point.accepted },
          { key: 'collected', value: parseAmount(point.collected), raw: point.collected },
        ];
        return (
          <g key={point.period}>
            {active ? (
              <rect
                x={padding.left + index * groupWidth}
                y={padding.top}
                width={groupWidth}
                height={innerHeight}
                fill="#0f172a"
                opacity={0.06}
              />
            ) : null}
            {values.map((item, i) => {
              const h = (item.value / maxValue) * innerHeight;
              return (
                <rect
                  key={item.key}
                  x={x0 + i * (barWidth + 3)}
                  y={padding.top + innerHeight - h}
                  width={barWidth}
                  height={Math.max(h, item.value > 0 ? 2 : 0)}
                  fill={SERIES[item.key].color}
                  rx={3}
                  className="cursor-pointer transition-opacity hover:opacity-80"
                  onClick={() => onSelect(point, item.key)}
                >
                  <title>
                    {`${formatPeriod(point.period)} · ${SERIES[item.key].label}: ${formatCurrencyVND(item.raw)}`}
                  </title>
                </rect>
              );
            })}
            <text
              x={padding.left + index * groupWidth + groupWidth / 2}
              y={height - 14}
              textAnchor="middle"
              className={cn(
                'cursor-pointer text-[10px]',
                active ? 'fill-slate-900 font-semibold' : 'fill-slate-500',
              )}
              onClick={() => onSelect(point)}
            >
              {formatPeriod(point.period)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function LineChart({
  data,
  width,
  height,
  padding,
  innerWidth,
  innerHeight,
  maxValue,
  selectedPeriod,
  onSelect,
}: {
  data: DashboardMonthlyPoint[];
  width: number;
  height: number;
  padding: { top: number; right: number; bottom: number; left: number };
  innerWidth: number;
  innerHeight: number;
  maxValue: number;
  selectedPeriod: string | null;
  onSelect: (point: DashboardMonthlyPoint, series?: keyof typeof SERIES) => void;
}) {
  const xStep = innerWidth / Math.max(data.length - 1, 1);
  const toX = (i: number) => padding.left + i * xStep;
  const toY = (v: number) =>
    padding.top + innerHeight - (v / maxValue) * innerHeight;
  const path = (values: number[]) =>
    values
      .map((v, i) => `${i === 0 ? 'M' : 'L'} ${toX(i)} ${toY(v)}`)
      .join(' ');

  const planned = data.map((d) => parseAmount(d.planned));
  const accepted = data.map((d) => parseAmount(d.accepted));
  const collected = data.map((d) => parseAmount(d.collected));

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full min-w-[640px]">
      {[0.25, 0.5, 0.75, 1].map((ratio) => {
        const y = padding.top + innerHeight * (1 - ratio);
        return (
          <line
            key={ratio}
            x1={padding.left}
            y1={y}
            x2={width - padding.right}
            y2={y}
            stroke="#e2e8f0"
            strokeDasharray="4 4"
          />
        );
      })}
      <path
        d={path(planned)}
        fill="none"
        stroke={SERIES.planned.color}
        strokeWidth="3"
      />
      <path
        d={path(accepted)}
        fill="none"
        stroke={SERIES.accepted.color}
        strokeWidth="3"
      />
      <path
        d={path(collected)}
        fill="none"
        stroke={SERIES.collected.color}
        strokeWidth="3"
      />
      {data.map((point, i) => {
        const active = selectedPeriod === point.period;
        return (
          <g key={point.period}>
            <circle
              cx={toX(i)}
              cy={toY(planned[i])}
              r={active ? 6 : 4.5}
              fill={SERIES.planned.color}
              stroke="#fff"
              strokeWidth="2"
              className="cursor-pointer"
              onClick={() => onSelect(point, 'planned')}
            >
              <title>
                {`${formatPeriod(point.period)} · Kế hoạch: ${formatCurrencyVND(point.planned)}`}
              </title>
            </circle>
            <circle
              cx={toX(i)}
              cy={toY(accepted[i])}
              r={active ? 6 : 4.5}
              fill={SERIES.accepted.color}
              stroke="#fff"
              strokeWidth="2"
              className="cursor-pointer"
              onClick={() => onSelect(point, 'accepted')}
            >
              <title>
                {`${formatPeriod(point.period)} · Nghiệm thu: ${formatCurrencyVND(point.accepted)}`}
              </title>
            </circle>
            <circle
              cx={toX(i)}
              cy={toY(collected[i])}
              r={active ? 6 : 4.5}
              fill={SERIES.collected.color}
              stroke="#fff"
              strokeWidth="2"
              className="cursor-pointer"
              onClick={() => onSelect(point, 'collected')}
            >
              <title>
                {`${formatPeriod(point.period)} · Thu tiền: ${formatCurrencyVND(point.collected)}`}
              </title>
            </circle>
            {/* hit area for whole month */}
            <rect
              x={toX(i) - 14}
              y={padding.top}
              width={28}
              height={innerHeight}
              fill="transparent"
              className="cursor-pointer"
              onClick={() => onSelect(point)}
            />
            <text
              x={toX(i)}
              y={height - 14}
              textAnchor="middle"
              className={cn(
                'cursor-pointer text-[10px]',
                active ? 'fill-slate-900 font-semibold' : 'fill-slate-500',
              )}
              onClick={() => onSelect(point)}
            >
              {formatPeriod(point.period)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap gap-4 text-sm font-medium text-slate-700">
      {(Object.keys(SERIES) as Array<keyof typeof SERIES>).map((key) => (
        <span key={key} className="inline-flex items-center gap-2">
          <span
            className="h-3 w-3 rounded-sm"
            style={{ background: SERIES[key].color }}
          />
          {SERIES[key].label}
        </span>
      ))}
    </div>
  );
}

export function DashboardPieChart({ data }: { data: DashboardStatusSlice[] }) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const slices = useMemo(
    () =>
      data
        .map((item, index) => ({
          ...item,
          value: parseAmount(item.amount),
          color: PIE_COLORS[index % PIE_COLORS.length],
        }))
        .filter((s) => s.value > 0),
    [data],
  );

  if (slices.length === 0) {
    return <p className="text-sm text-slate-500">Chưa có dữ liệu trạng thái.</p>;
  }

  const total = slices.reduce((sum, s) => sum + s.value, 0) || 1;
  const size = 240;
  const radius = 84;
  const inner = 44;
  const cx = size / 2;
  const cy = size / 2;

  const arcs = slices.reduce<
    Array<{
      key: string;
      label: string;
      amount: string;
      color: string;
      d: string;
      percent: string;
      endAngle: number;
    }>
  >((acc, slice) => {
    const start = acc.length === 0 ? -Math.PI / 2 : acc[acc.length - 1].endAngle;
    const sweep = (slice.value / total) * Math.PI * 2;
    const end = start + sweep;
    const large = sweep > Math.PI ? 1 : 0;
    const x1 = cx + radius * Math.cos(start);
    const y1 = cy + radius * Math.sin(start);
    const x2 = cx + radius * Math.cos(end);
    const y2 = cy + radius * Math.sin(end);
    const ix1 = cx + inner * Math.cos(end);
    const iy1 = cy + inner * Math.sin(end);
    const ix2 = cx + inner * Math.cos(start);
    const iy2 = cy + inner * Math.sin(start);
    const d = [
      `M ${x1} ${y1}`,
      `A ${radius} ${radius} 0 ${large} 1 ${x2} ${y2}`,
      `L ${ix1} ${iy1}`,
      `A ${inner} ${inner} 0 ${large} 0 ${ix2} ${iy2}`,
      'Z',
    ].join(' ');

    acc.push({
      key: slice.key,
      label: slice.label,
      amount: slice.amount,
      color: slice.color,
      d,
      percent: ((slice.value / total) * 100).toFixed(1),
      endAngle: end,
    });
    return acc;
  }, []);

  const selected = arcs.find((a) => a.key === selectedKey) ?? null;

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">Bấm vào phần tròn hoặc dòng chú thích để xem số</p>
      <div className="flex flex-col items-center gap-4 lg:flex-row lg:items-start">
        <svg viewBox={`0 0 ${size} ${size}`} className="h-60 w-60 shrink-0">
          {arcs.map((arc) => {
            const active = selectedKey === arc.key;
            return (
              <path
                key={arc.key}
                d={arc.d}
                fill={arc.color}
                opacity={selectedKey && !active ? 0.45 : 1}
                stroke="#fff"
                strokeWidth={active ? 3 : 1.5}
                className="cursor-pointer transition-opacity"
                onClick={() =>
                  setSelectedKey((prev) => (prev === arc.key ? null : arc.key))
                }
              >
                <title>
                  {`${arc.label}: ${formatCurrencyVND(arc.amount)} (${arc.percent}%)`}
                </title>
              </path>
            );
          })}
          {selected ? (
            <text
              x={cx}
              y={cy - 4}
              textAnchor="middle"
              className="fill-slate-900 text-[11px] font-semibold"
            >
              {selected.percent}%
            </text>
          ) : (
            <text
              x={cx}
              y={cy + 4}
              textAnchor="middle"
              className="fill-slate-500 text-[11px]"
            >
              Bấm để xem
            </text>
          )}
        </svg>
        <div className="w-full space-y-2">
          {arcs.map((arc) => {
            const active = selectedKey === arc.key;
            return (
              <button
                key={arc.key}
                type="button"
                onClick={() =>
                  setSelectedKey((prev) => (prev === arc.key ? null : arc.key))
                }
                className={cn(
                  'flex w-full items-center justify-between gap-3 rounded-md border px-3 py-2 text-left text-sm transition-colors',
                  active
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 bg-white hover:bg-slate-50',
                )}
              >
                <span className="inline-flex items-center gap-2">
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ background: arc.color }}
                  />
                  {arc.label}
                </span>
                <span className={cn('text-right font-semibold', active ? 'text-white' : 'text-slate-900')}>
                  {formatCurrencyVND(arc.amount)}
                  <span className={cn('ml-2 text-xs', active ? 'text-slate-300' : 'text-slate-500')}>
                    {arc.percent}%
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
      {selected ? (
        <DetailPanel
          title={selected.label}
          rows={[
            { label: 'Số tiền', value: selected.amount, color: selected.color },
            {
              label: 'Tỉ lệ',
              value: `${selected.percent}%`,
              color: selected.color,
              raw: true,
            },
          ]}
        />
      ) : null}
    </div>
  );
}

export function DashboardProjectBars({ data }: { data: DashboardProjectRow[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (data.length === 0) return null;
  const maxValue = Math.max(
    ...data.flatMap((d) => [
      parseAmount(d.planned),
      parseAmount(d.accepted),
      parseAmount(d.collected),
    ]),
    1,
  );

  const selected = data.find((d) => d.projectId === selectedId) ?? null;

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">Bấm vào dự án để xem số chi tiết</p>
      {data.map((row) => {
        const active = selectedId === row.projectId;
        return (
          <button
            key={row.projectId}
            type="button"
            onClick={() =>
              setSelectedId((prev) =>
                prev === row.projectId ? null : row.projectId,
              )
            }
            className={cn(
              'w-full space-y-1.5 rounded-lg border p-3 text-left transition-colors',
              active
                ? 'border-slate-900 bg-slate-900/5'
                : 'border-transparent hover:border-slate-200 hover:bg-slate-50',
            )}
          >
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="font-semibold text-slate-900">
                {row.projectCode} — {row.projectName}
              </span>
              <span className="text-xs font-medium text-emerald-700">
                NT {row.acceptanceRatePercent}%
              </span>
            </div>
            {(
              [
                { label: 'KH', value: row.planned, color: SERIES.planned.color },
                { label: 'NT', value: row.accepted, color: SERIES.accepted.color },
                { label: 'Thu', value: row.collected, color: SERIES.collected.color },
              ] as const
            ).map((bar) => (
              <div key={bar.label} className="flex items-center gap-2">
                <span className="w-8 text-xs font-medium text-slate-600">
                  {bar.label}
                </span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${(parseAmount(bar.value) / maxValue) * 100}%`,
                      background: bar.color,
                    }}
                  />
                </div>
                <span className="w-28 text-right text-xs font-medium text-slate-700">
                  {formatCurrencyVND(bar.value)}
                </span>
              </div>
            ))}
          </button>
        );
      })}
      {selected ? (
        <DetailPanel
          title={`${selected.projectCode} — ${selected.projectName}`}
          rows={[
            {
              label: 'Kế hoạch',
              value: selected.planned,
              color: SERIES.planned.color,
            },
            {
              label: 'Nghiệm thu',
              value: selected.accepted,
              color: SERIES.accepted.color,
            },
            {
              label: 'Thu tiền',
              value: selected.collected,
              color: SERIES.collected.color,
            },
            {
              label: 'Chưa NT',
              value: selected.remainingAcceptance,
              color: '#ea580c',
            },
            {
              label: 'Chưa thu',
              value: selected.outstandingCollection,
              color: '#dc2626',
            },
          ]}
        />
      ) : null}
    </div>
  );
}

export function filterMonthlyTrend(
  data: DashboardMonthlyPoint[],
  fromPeriod: string,
  toPeriod: string,
) {
  return data.filter((item) => {
    if (fromPeriod && item.period < fromPeriod) return false;
    if (toPeriod && item.period > toPeriod) return false;
    return true;
  });
}
