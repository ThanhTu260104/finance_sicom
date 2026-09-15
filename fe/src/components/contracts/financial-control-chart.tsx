'use client';

import { useMemo, useState } from 'react';
import {
  formatCurrencyVND,
  formatPeriod,
  isNegativeDecimal,
} from '@/lib/format';
import type { FinancialControlRow } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type FinanceChartType = 'bar' | 'line' | 'area' | 'cumulative';

const CHART_OPTIONS: Array<{ key: FinanceChartType; label: string }> = [
  { key: 'bar', label: 'Cột' },
  { key: 'line', label: 'Đường' },
  { key: 'area', label: 'Vùng' },
  { key: 'cumulative', label: 'Tích lũy' },
];

const SERIES = {
  planned: { color: '#475569', label: 'Kế hoạch' },
  acceptance: { color: '#0f766e', label: 'Nghiệm thu' },
  collected: { color: '#1d4ed8', label: 'Thu tiền' },
} as const;

function parseAmount(value?: string | null) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

type ChartPoint = {
  period: string;
  planned: number;
  acceptance: number;
  collected: number;
  cumulativePlanned: number;
  cumulativeAcceptance: number;
  cumulativeCollection: number;
  timelineStatus: FinancialControlRow['timelineStatus'];
  cumulativeVariance: string;
};

function buildChartPoints(
  rows: FinancialControlRow[],
  periods: string[],
): ChartPoint[] {
  const byPeriod = new Map(rows.map((row) => [row.period, row]));
  const ordered = (periods.length > 0 ? periods : rows.map((r) => r.period))
    .slice()
    .sort();

  let cumulativePlanned = 0;
  let cumulativeAcceptance = 0;
  let cumulativeCollection = 0;

  return ordered.map((period) => {
    const row = byPeriod.get(period);
    const planned = parseAmount(row?.plannedAmount);
    const acceptance = parseAmount(row?.acceptanceAmount);
    const collected = parseAmount(row?.collectedAmount);

    if (row) {
      cumulativePlanned = parseAmount(row.cumulativePlanned);
      cumulativeAcceptance = parseAmount(row.cumulativeAcceptance);
      cumulativeCollection = parseAmount(row.cumulativeCollection);
    } else {
      cumulativePlanned += planned;
      cumulativeAcceptance += acceptance;
      cumulativeCollection += collected;
    }

    return {
      period,
      planned,
      acceptance,
      collected,
      cumulativePlanned,
      cumulativeAcceptance,
      cumulativeCollection,
      timelineStatus: row?.timelineStatus ?? 'FUTURE',
      cumulativeVariance:
        row?.cumulativeVariance ??
        String(cumulativeAcceptance - cumulativePlanned),
    };
  });
}

function Legend() {
  return (
    <div className="flex flex-wrap gap-4 text-sm text-slate-600">
      {(Object.keys(SERIES) as Array<keyof typeof SERIES>).map((key) => (
        <span key={key} className="inline-flex items-center gap-2">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ background: SERIES[key].color }}
          />
          {SERIES[key].label}
        </span>
      ))}
    </div>
  );
}

function DetailPanel({ point }: { point: ChartPoint }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-sm font-semibold text-slate-900">
        Tháng {formatPeriod(point.period)}
        {point.timelineStatus === 'CURRENT' ? ' · kỳ hiện tại' : ''}
        {point.timelineStatus === 'FUTURE' ? ' · kỳ tương lai' : ''}
      </p>
      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        {(
          [
            ['planned', point.planned],
            ['acceptance', point.acceptance],
            ['collected', point.collected],
          ] as const
        ).map(([key, value]) => (
          <div key={key} className="rounded-md bg-white px-3 py-2 shadow-sm">
            <p className="inline-flex items-center gap-2 text-xs text-slate-500">
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: SERIES[key].color }}
              />
              {SERIES[key].label}
            </p>
            <p className="mt-0.5 text-sm font-semibold text-slate-900">
              {formatCurrencyVND(String(value))}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function useChartGeometry(pointCount: number, compact = false) {
  const width = Math.max(compact ? 480 : 720, pointCount * (compact ? 40 : 56));
  const height = compact ? 180 : 280;
  const padding = { top: 24, right: 20, bottom: 44, left: 16 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;
  return { width, height, padding, innerWidth, innerHeight };
}

function Grid({
  padding,
  width,
  innerHeight,
}: {
  padding: { top: number; right: number; bottom: number; left: number };
  width: number;
  innerHeight: number;
}) {
  return (
    <>
      {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
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
    </>
  );
}

function XLabels({
  points,
  toX,
  height,
}: {
  points: ChartPoint[];
  toX: (index: number) => number;
  height: number;
}) {
  const step = points.length > 18 ? 2 : 1;
  return (
    <>
      {points.map((point, index) =>
        index % step === 0 ? (
          <text
            key={point.period}
            x={toX(index)}
            y={height - 12}
            textAnchor="middle"
            className="fill-slate-500 text-[10px]"
          >
            {formatPeriod(point.period)}
          </text>
        ) : null,
      )}
    </>
  );
}

function BarChartView({
  points,
  selectedPeriod,
  onSelect,
  compact = false,
}: {
  points: ChartPoint[];
  selectedPeriod: string | null;
  onSelect: (point: ChartPoint) => void;
  compact?: boolean;
}) {
  const { width, height, padding, innerWidth, innerHeight } =
    useChartGeometry(points.length, compact);
  const maxValue = Math.max(
    ...points.flatMap((p) => [p.planned, p.acceptance, p.collected]),
    1,
  );
  const groupWidth = innerWidth / points.length;
  const barWidth = Math.max(groupWidth / 4.2, 4);
  const toY = (value: number) =>
    padding.top + innerHeight - (value / maxValue) * innerHeight;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ minWidth: width }}>
      <Grid padding={padding} width={width} innerHeight={innerHeight} />
      {points.map((point, index) => {
        const groupX = padding.left + index * groupWidth;
        const values = [
          ['planned', point.planned],
          ['acceptance', point.acceptance],
          ['collected', point.collected],
        ] as const;
        const active = selectedPeriod === point.period;
        return (
          <g key={point.period}>
            {point.timelineStatus === 'CURRENT' ? (
              <rect
                x={groupX}
                y={padding.top}
                width={groupWidth}
                height={innerHeight}
                fill="#e0f2fe"
                opacity={0.55}
              />
            ) : null}
            {values.map(([key, value], barIndex) => {
              const x = groupX + barWidth * 0.35 + barIndex * barWidth;
              const y = toY(value);
              const h = Math.max(padding.top + innerHeight - y, 0);
              return (
                <rect
                  key={key}
                  x={x}
                  y={y}
                  width={barWidth}
                  height={h}
                  fill={SERIES[key].color}
                  opacity={active ? 1 : 0.88}
                  className="cursor-pointer"
                  onClick={() => onSelect(point)}
                />
              );
            })}
            {active ? (
              <rect
                x={groupX + 2}
                y={padding.top}
                width={groupWidth - 4}
                height={innerHeight}
                fill="none"
                stroke="#0f172a"
                strokeWidth={1.5}
                strokeDasharray="3 3"
              />
            ) : null}
          </g>
        );
      })}
      <XLabels
        points={points}
        toX={(i) => padding.left + i * groupWidth + groupWidth / 2}
        height={height}
      />
    </svg>
  );
}

function LineOrAreaChartView({
  points,
  mode,
  selectedPeriod,
  onSelect,
  compact = false,
}: {
  points: ChartPoint[];
  mode: 'line' | 'area';
  selectedPeriod: string | null;
  onSelect: (point: ChartPoint) => void;
  compact?: boolean;
}) {
  const { width, height, padding, innerWidth, innerHeight } =
    useChartGeometry(points.length, compact);
  const maxValue = Math.max(
    ...points.flatMap((p) => [p.planned, p.acceptance, p.collected]),
    1,
  );
  const xStep = innerWidth / Math.max(points.length - 1, 1);
  const toX = (index: number) => padding.left + index * xStep;
  const toY = (value: number) =>
    padding.top + innerHeight - (value / maxValue) * innerHeight;
  const baseline = padding.top + innerHeight;

  const linePath = (values: number[]) =>
    values
      .map((value, index) => `${index === 0 ? 'M' : 'L'} ${toX(index)} ${toY(value)}`)
      .join(' ');

  const areaPath = (values: number[]) => {
    if (values.length === 0) return '';
    const line = values
      .map((value, index) => `${index === 0 ? 'M' : 'L'} ${toX(index)} ${toY(value)}`)
      .join(' ');
    return `${line} L ${toX(values.length - 1)} ${baseline} L ${toX(0)} ${baseline} Z`;
  };

  const series = [
    ['planned', points.map((p) => p.planned)],
    ['acceptance', points.map((p) => p.acceptance)],
    ['collected', points.map((p) => p.collected)],
  ] as const;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ minWidth: width }}>
      <Grid padding={padding} width={width} innerHeight={innerHeight} />
      {points.map((point, index) =>
        point.timelineStatus === 'CURRENT' ? (
          <line
            key={`cur-${point.period}`}
            x1={toX(index)}
            y1={padding.top}
            x2={toX(index)}
            y2={baseline}
            stroke="#7dd3fc"
            strokeWidth={8}
            opacity={0.35}
          />
        ) : null,
      )}
      {series.map(([key, values]) =>
        mode === 'area' ? (
          <path
            key={`area-${key}`}
            d={areaPath(values)}
            fill={SERIES[key].color}
            opacity={0.12}
          />
        ) : null,
      )}
      {series.map(([key, values]) => (
        <path
          key={`line-${key}`}
          d={linePath(values)}
          fill="none"
          stroke={SERIES[key].color}
          strokeWidth={key === 'collected' ? 2 : 2.5}
          strokeDasharray={key === 'collected' ? '6 4' : undefined}
        />
      ))}
      {points.map((point, index) => (
        <g key={point.period} className="cursor-pointer" onClick={() => onSelect(point)}>
          <circle
            cx={toX(index)}
            cy={toY(point.planned)}
            r={selectedPeriod === point.period ? 5 : 3.5}
            fill={SERIES.planned.color}
          />
          <circle
            cx={toX(index)}
            cy={toY(point.acceptance)}
            r={selectedPeriod === point.period ? 5 : 3.5}
            fill={SERIES.acceptance.color}
          />
          <circle
            cx={toX(index)}
            cy={toY(point.collected)}
            r={selectedPeriod === point.period ? 5 : 3}
            fill={SERIES.collected.color}
          />
        </g>
      ))}
      <XLabels points={points} toX={toX} height={height} />
    </svg>
  );
}

function CumulativeChartView({
  points,
  selectedPeriod,
  onSelect,
  compact = false,
}: {
  points: ChartPoint[];
  selectedPeriod: string | null;
  onSelect: (point: ChartPoint) => void;
  compact?: boolean;
}) {
  const { width, height, padding, innerWidth, innerHeight } =
    useChartGeometry(points.length, compact);
  const maxValue = Math.max(
    ...points.flatMap((p) => [
      p.cumulativePlanned,
      p.cumulativeAcceptance,
      p.cumulativeCollection,
    ]),
    1,
  );
  const xStep = innerWidth / Math.max(points.length - 1, 1);
  const toX = (index: number) => padding.left + index * xStep;
  const toY = (value: number) =>
    padding.top + innerHeight - (value / maxValue) * innerHeight;

  const linePath = (values: number[]) =>
    values
      .map((value, index) => `${index === 0 ? 'M' : 'L'} ${toX(index)} ${toY(value)}`)
      .join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ minWidth: width }}>
      <Grid padding={padding} width={width} innerHeight={innerHeight} />
      <path
        d={linePath(points.map((p) => p.cumulativePlanned))}
        fill="none"
        stroke={SERIES.planned.color}
        strokeWidth={2.5}
      />
      <path
        d={linePath(points.map((p) => p.cumulativeAcceptance))}
        fill="none"
        stroke={SERIES.acceptance.color}
        strokeWidth={2.5}
      />
      <path
        d={linePath(points.map((p) => p.cumulativeCollection))}
        fill="none"
        stroke={SERIES.collected.color}
        strokeWidth={2}
        strokeDasharray="6 4"
      />
      {points.map((point, index) => (
        <g key={point.period} className="cursor-pointer" onClick={() => onSelect(point)}>
          <circle
            cx={toX(index)}
            cy={toY(point.cumulativePlanned)}
            r={selectedPeriod === point.period ? 5 : 3.5}
            fill={SERIES.planned.color}
          />
          <circle
            cx={toX(index)}
            cy={toY(point.cumulativeAcceptance)}
            r={selectedPeriod === point.period ? 5 : 3.5}
            fill={SERIES.acceptance.color}
          />
        </g>
      ))}
      <XLabels points={points} toX={toX} height={height} />
    </svg>
  );
}

export function FinancialControlChart({
  rows,
  periods,
  compact = false,
}: {
  rows: FinancialControlRow[];
  periods: string[];
  compact?: boolean;
}) {
  const [selectedTypes, setSelectedTypes] = useState<FinanceChartType[]>([
    'bar',
    'line',
  ]);
  const [selectedPeriod, setSelectedPeriod] = useState<string | null>(null);

  const points = useMemo(
    () => buildChartPoints(rows, periods),
    [rows, periods],
  );

  const selectedPoint =
    points.find((p) => p.period === selectedPeriod) ?? null;

  const behindMonth = [...points]
    .reverse()
    .find(
      (row) =>
        row.timelineStatus !== 'FUTURE' &&
        isNegativeDecimal(row.cumulativeVariance),
    );

  const toggleType = (type: FinanceChartType) => {
    setSelectedTypes((prev) => {
      if (prev.includes(type)) {
        if (prev.length === 1) return prev;
        return prev.filter((item) => item !== type);
      }
      return [...prev, type];
    });
  };

  if (points.length === 0) {
    return (
      <p className="text-sm text-slate-500">Chưa có dữ liệu để vẽ biểu đồ.</p>
    );
  }

  return (
    <div className={cn('space-y-4', compact && 'space-y-3')}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className={cn('text-slate-600', compact ? 'text-xs' : 'text-sm')}>
          {compact
            ? `Chọn nhiều biểu đồ · ${points.length} kỳ`
            : `Hiển thị đủ ${points.length} tháng theo thời hạn hợp đồng. Có thể chọn nhiều loại biểu đồ cùng lúc.`}
        </p>
        <div className="flex flex-wrap gap-2">
          {CHART_OPTIONS.map((item) => {
            const active = selectedTypes.includes(item.key);
            return (
              <Button
                key={item.key}
                size="sm"
                variant={active ? 'default' : 'outline'}
                className={cn(!active && 'bg-white', compact && 'h-8 px-2.5 text-xs')}
                onClick={() => toggleType(item.key)}
              >
                {item.label}
              </Button>
            );
          })}
        </div>
      </div>

      <Legend />

      <div className={cn('grid gap-4', compact && 'gap-3')}>
        {selectedTypes.includes('bar') ? (
          <div
            className={cn(
              'space-y-2 rounded-lg border border-slate-200 p-3',
              compact && 'p-2',
            )}
          >
            <p
              className={cn(
                'font-medium text-slate-800',
                compact ? 'text-xs' : 'text-sm',
              )}
            >
              Biểu đồ cột
            </p>
            {!compact ? (
              <p className="text-xs text-slate-500">
                Đủ {points.length} kỳ theo thời hạn HĐ · bấm cột để xem số
              </p>
            ) : null}
            <div className="overflow-x-auto">
              <BarChartView
                compact={compact}
                points={points}
                selectedPeriod={selectedPeriod}
                onSelect={(point) => setSelectedPeriod(point.period)}
              />
            </div>
          </div>
        ) : null}

        {selectedTypes.includes('line') ? (
          <div
            className={cn(
              'space-y-2 rounded-lg border border-slate-200 p-3',
              compact && 'p-2',
            )}
          >
            <p
              className={cn(
                'font-medium text-slate-800',
                compact ? 'text-xs' : 'text-sm',
              )}
            >
              Biểu đồ đường
            </p>
            {!compact ? (
              <p className="text-xs text-slate-500">
                Đủ {points.length} kỳ theo thời hạn HĐ · bấm điểm để xem số
              </p>
            ) : null}
            <div className="overflow-x-auto">
              <LineOrAreaChartView
                compact={compact}
                points={points}
                mode="line"
                selectedPeriod={selectedPeriod}
                onSelect={(point) => setSelectedPeriod(point.period)}
              />
            </div>
          </div>
        ) : null}

        {selectedTypes.includes('area') ? (
          <div
            className={cn(
              'space-y-2 rounded-lg border border-slate-200 p-3',
              compact && 'p-2',
            )}
          >
            <p
              className={cn(
                'font-medium text-slate-800',
                compact ? 'text-xs' : 'text-sm',
              )}
            >
              Biểu đồ vùng
            </p>
            {!compact ? (
              <p className="text-xs text-slate-500">
                Đủ {points.length} kỳ theo thời hạn HĐ · bấm điểm để xem số
              </p>
            ) : null}
            <div className="overflow-x-auto">
              <LineOrAreaChartView
                compact={compact}
                points={points}
                mode="area"
                selectedPeriod={selectedPeriod}
                onSelect={(point) => setSelectedPeriod(point.period)}
              />
            </div>
          </div>
        ) : null}

        {selectedTypes.includes('cumulative') ? (
          <div
            className={cn(
              'space-y-2 rounded-lg border border-slate-200 p-3',
              compact && 'p-2',
            )}
          >
            <p
              className={cn(
                'font-medium text-slate-800',
                compact ? 'text-xs' : 'text-sm',
              )}
            >
              Biểu đồ tích lũy
            </p>
            {!compact ? (
              <p className="text-xs text-slate-500">
                Lũy kế kế hoạch / nghiệm thu / thu tiền xuyên suốt thời hạn HĐ
              </p>
            ) : null}
            <div className="overflow-x-auto">
              <CumulativeChartView
                compact={compact}
                points={points}
                selectedPeriod={selectedPeriod}
                onSelect={(point) => setSelectedPeriod(point.period)}
              />
            </div>
          </div>
        ) : null}
      </div>

      {selectedPoint ? (
        <DetailPanel point={selectedPoint} />
      ) : compact ? null : (
        <p className="text-xs text-slate-400">
          Chưa chọn kỳ nào trên biểu đồ.
        </p>
      )}

      {!compact && behindMonth ? (
        <p className="text-sm text-red-600">
          Chậm kế hoạch tích lũy tại {formatPeriod(behindMonth.period)}:{' '}
          {formatCurrencyVND(behindMonth.cumulativeVariance)}
        </p>
      ) : null}
    </div>
  );
}
