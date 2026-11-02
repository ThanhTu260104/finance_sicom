'use client';

import { useEffect, useMemo, useState } from 'react';
import type { DashboardCumulativeTrendPoint } from '@/lib/types';
import {
  CHART_SERIES_ACCEPTANCE,
  CHART_SERIES_COLLECTION,
  CHART_SERIES_OPERATING_COST,
  CHART_SERIES_ACTUAL_WORK,
  CHART_SERIES_PLAN,
} from '@/lib/chart-colors';
import { ChartDisplayRangeFilter } from './chart-display-range-filter';
import { ChartSeriesToggle } from './chart-series-toggle';
import {
  axisMoneyLabel,
  chartMax,
  chartPointMoneyLabel,
  trendPointAxisLabel,
  trendPointRangeText,
  trendPointFullLabel,
  parseChartAmount,
  percentOfAmounts,
} from './chart-utils';
import { ChartTooltipOverlay } from './chart-tooltip-overlay';
import type { FinancialTooltipPayload } from './financial-tooltip';
import {
  TimeSeriesChartTypeSelector,
  type TimeSeriesChartType,
} from './chart-type-selector';
import { ChartFullscreenModal } from './chart-fullscreen-modal';
import { ChartExpandButton } from './chart-expand-button';
import type { ChartContextItem } from './chart-context-bar';
import { cn } from '@/lib/utils';
import type { BillingCycle } from '@/lib/types';
import {
  BATCH_BAND_SVG_FILL,
  batchLabel,
  buildPeriodBatchDecorations,
  type PeriodBatchDecoration,
} from '@/lib/plan-batch-period-map';

type Mode = 'cumulative' | 'period';
type AcceptanceReportingMode = 'occurrence' | 'planPeriod';

type SeriesKey =
  | 'plannedAcceptanceCumulative'
  | 'actualAcceptanceCumulative'
  | 'actualWorkCumulative'
  | 'actualCollectionCumulative'
  | 'operatingCostCumulative'
  | 'plannedAcceptance'
  | 'actualAcceptance'
  | 'actualWork'
  | 'actualCollection'
  | 'operatingCost';

type SeriesDef = { key: SeriesKey; label: string; color: string };

const CUMULATIVE_SERIES: SeriesDef[] = [
  {
    key: 'plannedAcceptanceCumulative',
    label: 'Kế hoạch NT',
    color: CHART_SERIES_PLAN,
  },
  {
    key: 'actualAcceptanceCumulative',
    label: 'NT thực tế',
    color: CHART_SERIES_ACCEPTANCE,
  },
  {
    key: 'actualWorkCumulative',
    label: 'Thực hiện',
    color: CHART_SERIES_ACTUAL_WORK,
  },
  {
    key: 'actualCollectionCumulative',
    label: 'Thu thực tế',
    color: CHART_SERIES_COLLECTION,
  },
  {
    key: 'operatingCostCumulative',
    label: 'Chi phí',
    color: CHART_SERIES_OPERATING_COST,
  },
];

const PERIOD_SERIES: SeriesDef[] = [
  {
    key: 'plannedAcceptance',
    label: 'KH nghiệm thu',
    color: CHART_SERIES_PLAN,
  },
  {
    key: 'actualAcceptance',
    label: 'NT thực tế',
    color: CHART_SERIES_ACCEPTANCE,
  },
  {
    key: 'actualWork',
    label: 'Thực hiện',
    color: CHART_SERIES_ACTUAL_WORK,
  },
  {
    key: 'actualCollection',
    label: 'Thu thực tế',
    color: CHART_SERIES_COLLECTION,
  },
  {
    key: 'operatingCost',
    label: 'Chi phí',
    color: CHART_SERIES_OPERATING_COST,
  },
];

function acceptanceSeriesLabel(
  mode: Mode,
  reporting: AcceptanceReportingMode,
): string {
  // Backend gom NT theo đợt đã chọn khi nghiệm thu (không theo ngày NT)
  return reporting === 'planPeriod'
    ? 'NT thực tế (kỳ KH)'
    : 'NT thực tế (theo đợt)';
}

function seriesForMode(
  mode: Mode,
  includeOperatingCost: boolean,
  acceptanceReporting: AcceptanceReportingMode = 'occurrence',
): SeriesDef[] {
  const base = mode === 'cumulative' ? CUMULATIVE_SERIES : PERIOD_SERIES;
  const filtered = includeOperatingCost
    ? base
    : base.filter((s) => !s.key.includes('operatingCost'));
  const ntLabel = acceptanceSeriesLabel(mode, acceptanceReporting);
  const thuLabel =
    acceptanceReporting === 'planPeriod'
      ? 'Thu thực tế (kỳ KH)'
      : 'Thu thực tế (theo đợt)';
  return filtered.map((s) => {
    if (s.key === 'actualAcceptance' || s.key === 'actualAcceptanceCumulative') {
      return { ...s, label: ntLabel };
    }
    if (s.key === 'actualCollection' || s.key === 'actualCollectionCumulative') {
      return { ...s, label: thuLabel };
    }
    return s;
  });
}

function amountForSeriesKey(
  point: DashboardCumulativeTrendPoint,
  key: SeriesKey,
  acceptanceReporting: AcceptanceReportingMode = 'occurrence',
): string {
  if (acceptanceReporting === 'planPeriod') {
    if (key === 'actualAcceptance' || key === 'actualAcceptanceCumulative') {
      const planKey =
        key === 'actualAcceptanceCumulative'
          ? point.actualAcceptancePlanPeriodCumulative
          : point.actualAcceptancePlanPeriod;
      if (typeof planKey === 'string') return planKey;
    }
    if (key === 'actualCollection' || key === 'actualCollectionCumulative') {
      const planKey =
        key === 'actualCollectionCumulative'
          ? point.actualCollectionPlanPeriodCumulative
          : point.actualCollectionPlanPeriod;
      if (typeof planKey === 'string') return planKey;
    }
  }
  const v = point[key as keyof DashboardCumulativeTrendPoint];
  if (typeof v === 'string') return v;
  return '0';
}

type DisplaySize = 'inline' | 'fullscreen';

function timeSeriesDisplayConfig(
  dataLength: number,
  displaySize: DisplaySize,
  showBatchLabels = false,
  /** Trục theo đợt — nhãn "Đợt n (dd/mm/yyyy - dd/mm/yyyy)" dài hơn tháng */
  pointLabels = false,
) {
  const labelRotate =
    displaySize === 'fullscreen'
      ? dataLength > (pointLabels ? 8 : 12)
        ? -45
        : 0
      : dataLength > 18
        ? -55
        : dataLength > (pointLabels ? 6 : 10)
          ? -45
          : 0;
  const batchPad =
    (showBatchLabels ? 16 : 0) +
    (pointLabels ? (labelRotate !== 0 ? 64 : 14) : 0);

  if (displaySize === 'fullscreen') {
    const width = Math.max(1280, 96 + Math.max(dataLength - 1, 1) * 36);
    const height = 560 + batchPad;
    const pad = {
      top: 44,
      right: 28,
      bottom: (labelRotate !== 0 ? 108 : 72) + batchPad,
      left: 72,
    };
    return {
      width,
      height,
      pad,
      labelRotate,
      axisFontSize: 10,
      labelFontSize: dataLength > 30 ? 8 : 9,
      pointLabelFontSize: dataLength > 24 ? 7 : dataLength > 14 ? 8 : 9,
      svgClassName: 'h-auto w-full min-h-[460px]',
    };
  }

  return {
    width: 920,
    height: 280 + batchPad,
    pad: { top: 32, right: 16, bottom: 68 + batchPad, left: 48 },
    labelRotate,
    axisFontSize: 8,
    labelFontSize: dataLength > 24 ? 6.5 : dataLength > 14 ? 7 : 8,
    pointLabelFontSize: dataLength > 24 ? 6 : dataLength > 14 ? 6.5 : 7.5,
    svgClassName: batchPad > 30 ? 'h-auto w-full max-h-[400px]' : 'h-auto w-full max-h-[320px]',
  };
}

export function FinancialTimeSeriesChart({
  data,
  currentPeriod,
  mode: modeProp = 'cumulative',
  defaultChartType = 'line',
  contractValueForProgress,
  title,
  fullscreenContext,
  showSeriesToggle = false,
  showChartPeriodFilter = false,
  allowModeSwitch = false,
  includeOperatingCost = true,
  billingCycle,
  showAcceptanceBatches = false,
  showAcceptanceReportingToggle = false,
}: {
  data: DashboardCumulativeTrendPoint[];
  currentPeriod?: string;
  mode?: Mode;
  defaultChartType?: TimeSeriesChartType;
  contractValueForProgress?: string;
  title?: string;
  fullscreenContext?: ChartContextItem[];
  /** Bật ẩn/hiện từng chuỗi (KH, NT, thu, chi phí) */
  showSeriesToggle?: boolean;
  /** Lọc khoảng tháng hiển thị trên biểu đồ (mặc định full data API) */
  showChartPeriodFilter?: boolean;
  allowModeSwitch?: boolean;
  /** Hợp đồng: không hiển thị chuỗi chi phí dự án */
  includeOperatingCost?: boolean;
  /** Dashboard HĐ — tô nền + nhãn Đợt trên trục tháng */
  billingCycle?: BillingCycle;
  showAcceptanceBatches?: boolean;
  /** NT theo ngày NT (mặc định) hoặc theo kỳ KH (acceptance.period) */
  showAcceptanceReportingToggle?: boolean;
}) {
  const [fullscreen, setFullscreen] = useState(false);
  const [mode, setMode] = useState<Mode>(modeProp);
  const modalTitle =
    title ??
    (mode === 'period' ? 'Tài chính theo tháng' : 'S-Curve lũy kế');

  useEffect(() => {
    setMode(modeProp);
  }, [modeProp]);

  if (data.length === 0) {
    return <p className="text-sm text-slate-500">Chưa có dữ liệu biểu đồ.</p>;
  }

  const panelProps = {
    data,
    currentPeriod,
    mode,
    setMode: allowModeSwitch ? setMode : undefined,
    defaultChartType,
    contractValueForProgress,
    showSeriesToggle,
    showChartPeriodFilter,
    allowModeSwitch,
    includeOperatingCost,
    billingCycle,
    showAcceptanceBatches,
    showAcceptanceReportingToggle,
  };

  return (
    <>
      <FinancialTimeSeriesChartPanel
        {...panelProps}
        displaySize="inline"
        onExpand={() => setFullscreen(true)}
      />
      <ChartFullscreenModal
        open={fullscreen}
        onClose={() => setFullscreen(false)}
        title={modalTitle}
        contextItems={fullscreenContext}
      >
        <FinancialTimeSeriesChartPanel
          {...panelProps}
          displaySize="fullscreen"
        />
      </ChartFullscreenModal>
    </>
  );
}

function FinancialTimeSeriesChartPanel({
  data,
  currentPeriod,
  mode = 'cumulative',
  setMode,
  defaultChartType = 'line',
  contractValueForProgress,
  displaySize,
  onExpand,
  showSeriesToggle = false,
  showChartPeriodFilter = false,
  allowModeSwitch = false,
  includeOperatingCost = true,
  billingCycle,
  showAcceptanceBatches = false,
  showAcceptanceReportingToggle = false,
}: {
  data: DashboardCumulativeTrendPoint[];
  currentPeriod?: string;
  mode?: Mode;
  setMode?: (m: Mode) => void;
  defaultChartType?: TimeSeriesChartType;
  contractValueForProgress?: string;
  displaySize: DisplaySize;
  onExpand?: () => void;
  showSeriesToggle?: boolean;
  showChartPeriodFilter?: boolean;
  allowModeSwitch?: boolean;
  includeOperatingCost?: boolean;
  billingCycle?: BillingCycle;
  showAcceptanceBatches?: boolean;
  showAcceptanceReportingToggle?: boolean;
}) {
  const [chartType, setChartType] = useState<TimeSeriesChartType>(defaultChartType);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(() => new Set());
  const [viewFrom, setViewFrom] = useState('');
  const [viewTo, setViewTo] = useState('');
  const [acceptanceReporting, setAcceptanceReporting] =
    useState<AcceptanceReportingMode>('occurrence');

  const periodSignature = data.map((d) => d.period).join('|');

  useEffect(() => {
    if (!data.length) return;
    setViewFrom(data[0]!.period);
    setViewTo(data[data.length - 1]!.period);
  }, [periodSignature, data]);

  useEffect(() => {
    setHiddenSeries(new Set());
  }, [mode]);

  const allSeries = seriesForMode(mode, includeOperatingCost, acceptanceReporting);
  const visibleSeries = useMemo(
    () =>
      showSeriesToggle
        ? allSeries.filter((s) => !hiddenSeries.has(s.key))
        : allSeries,
    [allSeries, hiddenSeries, showSeriesToggle],
  );

  const batchDecorations = useMemo(() => {
    if (!showAcceptanceBatches) return new Map<string, PeriodBatchDecoration>();
    const periods = data.map((d) => d.period);
    return buildPeriodBatchDecorations(periods, data, billingCycle);
  }, [data, billingCycle, showAcceptanceBatches]);

  const showBatchLabels = showAcceptanceBatches && batchDecorations.size > 0;

  const displayData = useMemo(() => {
    if (!showChartPeriodFilter || !viewFrom || !viewTo) return data;
    let from = viewFrom;
    let to = viewTo;
    if (from > to) {
      const swap = from;
      from = to;
      to = swap;
    }
    return data.filter((d) => d.period >= from && d.period <= to);
  }, [data, showChartPeriodFilter, viewFrom, viewTo]);

  const toggleSeries = (key: string) => {
    setHiddenSeries((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const chart = useMemo(() => {
    if (displayData.length === 0 || visibleSeries.length === 0) return null;
    const cfg = timeSeriesDisplayConfig(
      displayData.length,
      displaySize,
      showBatchLabels,
      displayData.some((d) => d.label),
    );
    const { width, height, pad } = cfg;
    const innerW = width - pad.left - pad.right;
    const innerH = height - pad.top - pad.bottom;
    const maxY = chartMax(
      displayData.flatMap((d) =>
        visibleSeries.map((s) =>
          parseChartAmount(
            amountForSeriesKey(d, s.key, acceptanceReporting),
          ),
        ),
      ),
    );
    const n = displayData.length;
    const xAt = (i: number) =>
      pad.left + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
    const yAt = (v: number) => pad.top + innerH - (v / maxY) * innerH;
    const markerIndex = currentPeriod
      ? displayData.findIndex((d) => d.period === currentPeriod)
      : -1;
    const markerX =
      markerIndex >= 0 ? xAt(markerIndex) : pad.left + innerW * 0.5;
    const labelY = height - pad.bottom + 10;

    return {
      ...cfg,
      width,
      height,
      pad,
      innerW,
      innerH,
      maxY,
      xAt,
      yAt,
      markerX,
      labelY,
    };
  }, [
    displayData,
    visibleSeries,
    currentPeriod,
    displaySize,
    showBatchLabels,
    acceptanceReporting,
  ]);

  if (!chart || visibleSeries.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        Chọn ít nhất một chuỗi để hiển thị.
      </p>
    );
  }

  const showTooltip = hoverIndex !== null;
  const activeIndex = hoverIndex ?? 0;
  const active = displayData[activeIndex];
  const tooltipPayload = buildTooltipPayload(
    active,
    mode,
    contractValueForProgress,
    acceptanceReporting,
  );
  const anchorXPercent = (chart.xAt(activeIndex) / chart.width) * 100;

  const shellClass =
    displaySize === 'inline'
      ? 'space-y-3 rounded-xl border border-slate-200 bg-white p-4'
      : 'space-y-3';

  return (
    <div className={shellClass}>
      <div className="flex flex-col gap-3">
        {showChartPeriodFilter && data.length > 0 ? (
          <ChartDisplayRangeFilter
            periods={data.map((d) => d.period)}
            labels={
              data.some((d) => d.label)
                ? new Map(data.map((d) => [d.period, trendPointAxisLabel(d)]))
                : undefined
            }
            fromPeriod={viewFrom || data[0]!.period}
            toPeriod={viewTo || data[data.length - 1]!.period}
            onFromChange={setViewFrom}
            onToChange={setViewTo}
            onReset={() => {
              setViewFrom(data[0]!.period);
              setViewTo(data[data.length - 1]!.period);
            }}
          />
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3">
          {showSeriesToggle ? (
            <ChartSeriesToggle
              series={allSeries}
              hiddenKeys={hiddenSeries}
              onToggle={toggleSeries}
            />
          ) : (
            <div className="flex flex-wrap gap-3 text-xs text-slate-600">
              {allSeries.map((s) => (
                <span key={s.key} className="inline-flex items-center gap-1.5">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: s.color }}
                  />
                  {s.label}
                </span>
              ))}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {allowModeSwitch && setMode ? (
              <div className="flex gap-1">
                <button
                  type="button"
                  className={cn(
                    'rounded-md border px-2 py-1 text-[11px] font-medium',
                    mode === 'cumulative'
                      ? 'border-slate-800 bg-slate-800 text-white'
                      : 'border-slate-200 bg-white text-slate-600',
                  )}
                  onClick={() => setMode('cumulative')}
                >
                  S-Curve
                </button>
                <button
                  type="button"
                  className={cn(
                    'rounded-md border px-2 py-1 text-[11px] font-medium',
                    mode === 'period'
                      ? 'border-slate-800 bg-slate-800 text-white'
                      : 'border-slate-200 bg-white text-slate-600',
                  )}
                  onClick={() => setMode('period')}
                >
                  Theo tháng
                </button>
              </div>
            ) : null}
            {showAcceptanceReportingToggle ? (
              <div className="flex gap-1">
                <button
                  type="button"
                  className={cn(
                    'rounded-md border px-2 py-1 text-[11px] font-medium',
                    acceptanceReporting === 'occurrence'
                      ? 'border-slate-800 bg-slate-800 text-white'
                      : 'border-slate-200 bg-white text-slate-600',
                  )}
                  onClick={() => setAcceptanceReporting('occurrence')}
                  title="Cộng NT vào tháng của ngày nghiệm thu"
                >
                  NT: ngày NT
                </button>
                <button
                  type="button"
                  className={cn(
                    'rounded-md border px-2 py-1 text-[11px] font-medium',
                    acceptanceReporting === 'planPeriod'
                      ? 'border-slate-800 bg-slate-800 text-white'
                      : 'border-slate-200 bg-white text-slate-600',
                  )}
                  onClick={() => setAcceptanceReporting('planPeriod')}
                  title="Cộng NT theo kỳ kế hoạch (acceptance.period)"
                >
                  NT: kỳ KH
                </button>
              </div>
            ) : null}
            <TimeSeriesChartTypeSelector
              value={chartType}
              onChange={setChartType}
            />
            {onExpand ? <ChartExpandButton onClick={onExpand} /> : null}
          </div>
        </div>
      </div>

      <div className="relative max-w-full">
        <ChartTooltipOverlay
          data={tooltipPayload}
          visible={showTooltip}
          leftPercent={anchorXPercent}
        />
        <svg
          viewBox={`0 0 ${chart.width} ${chart.height}`}
          className={chart.svgClassName}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label="Biểu đồ theo thời gian"
        >
          {[0, 0.25, 0.5, 0.75, 1].map((t) => {
            const y = chart.pad.top + chart.innerH * (1 - t);
            const val = chart.maxY * t;
            return (
              <g key={t}>
                <line
                  x1={chart.pad.left}
                  x2={chart.width - chart.pad.right}
                  y1={y}
                  y2={y}
                  stroke="#e2e8f0"
                  strokeWidth={1}
                />
                <text
                  x={chart.pad.left - 6}
                  y={y + 3}
                  textAnchor="end"
                  className="fill-slate-500"
                  fontSize={chart.axisFontSize}
                >
                  {axisMoneyLabel(val)}
                </text>
              </g>
            );
          })}

          {showBatchLabels ? (
            <AcceptanceBatchBands
              data={displayData}
              chart={chart}
              decorations={batchDecorations}
              chartType={chartType}
            />
          ) : null}

          <HoverBands
            data={displayData}
            chart={chart}
            hoverIndex={hoverIndex}
            onHover={setHoverIndex}
          />

          {chartType === 'column' ? (
            <ColumnSeries
              data={displayData}
              series={visibleSeries}
              chart={chart}
              activeIndex={hoverIndex}
              onHover={setHoverIndex}
              acceptanceReporting={acceptanceReporting}
            />
          ) : (
            <LineAreaSeries
              data={displayData}
              series={visibleSeries}
              chart={chart}
              chartType={chartType}
              activeIndex={hoverIndex}
              onHover={setHoverIndex}
              acceptanceReporting={acceptanceReporting}
            />
          )}

          {hoverIndex !== null ? (
            <line
              x1={chart.xAt(hoverIndex)}
              x2={chart.xAt(hoverIndex)}
              y1={chart.pad.top}
              y2={chart.height - chart.pad.bottom}
              stroke="#64748b"
              strokeWidth={1}
              strokeDasharray="3 2"
            />
          ) : null}

          {currentPeriod ? (
            <line
              x1={chart.markerX}
              x2={chart.markerX}
              y1={chart.pad.top}
              y2={chart.height - chart.pad.bottom}
              stroke="#0f172a"
              strokeWidth={1}
              strokeDasharray="4 3"
            />
          ) : null}

          {displayData.map((d, i) => {
            const x = chart.xAt(i);
            const y = chart.labelY;
            const rotate = chart.labelRotate;
            const anchor = rotate !== 0 ? 'end' : 'middle';
            const batch = batchDecorations.get(d.period);
            const batchText =
              showBatchLabels && batch
                ? batchLabel(batch.batchSequence)
                : null;
            return (
              <g key={d.period}>
                <text
                  x={x}
                  y={y}
                  textAnchor={anchor}
                  transform={
                    rotate !== 0 ? `rotate(${rotate}, ${x}, ${y})` : undefined
                  }
                  className="fill-slate-600"
                  fontSize={chart.labelFontSize}
                >
                  {d.label && rotate === 0 ? (
                    // Theo đợt, trục thẳng: "Đợt 1" / "(12/03/2026 - 11/06/2026)"
                    <>
                      <tspan x={x} className="font-semibold">
                        {d.label}
                      </tspan>
                      {trendPointRangeText(d) ? (
                        <tspan
                          x={x}
                          dy={chart.labelFontSize + 3}
                          className="fill-slate-500"
                          fontSize={Math.max(chart.labelFontSize - 1, 6)}
                        >
                          {trendPointRangeText(d)}
                        </tspan>
                      ) : null}
                    </>
                  ) : (
                    trendPointAxisLabel(d)
                  )}
                </text>
                {batchText && rotate === 0 ? (
                  <text
                    x={x}
                    y={y + 12}
                    textAnchor="middle"
                    className="fill-slate-400"
                    fontSize={Math.max(chart.labelFontSize - 1.5, 6)}
                  >
                    {batchText}
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>
      </div>
      <p className="text-xs text-slate-500">
        Di chuột lên biểu đồ để xem số liệu chi tiết (VND đầy đủ).
        {showBatchLabels
          ? ' · Nền pastel + nhãn Đợt: các tháng cùng đợt nghiệm thu.'
          : null}
        {onExpand ? ' · Bấm Phóng to để xem full màn hình.' : null}
      </p>
    </div>
  );
}

function AcceptanceBatchBands({
  data,
  chart,
  decorations,
  chartType,
}: {
  data: DashboardCumulativeTrendPoint[];
  chart: ChartLayout;
  decorations: Map<string, PeriodBatchDecoration>;
  chartType: TimeSeriesChartType;
}) {
  if (decorations.size === 0) return null;

  if (chartType === 'column') {
    const groupW = chart.innerW / Math.max(data.length, 1);
    return (
      <>
        {data.map((d, i) => {
          const dec = decorations.get(d.period);
          if (!dec) return null;
          const fill =
            BATCH_BAND_SVG_FILL[dec.bandIndex % BATCH_BAND_SVG_FILL.length];
          const x = chart.pad.left + i * groupW;
          return (
            <rect
              key={`batch-col-${d.period}`}
              x={x}
              y={chart.pad.top}
              width={groupW}
              height={chart.innerH}
              fill={fill}
              fillOpacity={0.82}
            />
          );
        })}
      </>
    );
  }

  const bandW =
    data.length <= 1
      ? chart.innerW
      : chart.innerW / Math.max(data.length - 1, 1);

  return (
    <>
      {data.map((d, i) => {
        const dec = decorations.get(d.period);
        if (!dec) return null;
        const fill =
          BATCH_BAND_SVG_FILL[dec.bandIndex % BATCH_BAND_SVG_FILL.length];
        const cx = chart.xAt(i);
        const x =
          data.length <= 1 ? chart.pad.left : cx - bandW / 2;
        return (
          <rect
            key={`batch-line-${d.period}`}
            x={x}
            y={chart.pad.top}
            width={bandW}
            height={chart.innerH}
            fill={fill}
            fillOpacity={0.82}
          />
        );
      })}
    </>
  );
}

function HoverBands({
  data,
  chart,
  hoverIndex,
  onHover,
}: {
  data: DashboardCumulativeTrendPoint[];
  chart: ChartLayout;
  hoverIndex: number | null;
  onHover: (i: number | null) => void;
}) {
  const bandW =
    data.length <= 1
      ? chart.innerW
      : chart.innerW / Math.max(data.length - 1, 1);
  return (
    <>
      {data.map((d, i) => {
        const cx = chart.xAt(i);
        const x =
          data.length <= 1
            ? chart.pad.left
            : cx - bandW / 2;
        return (
          <rect
            key={`band-${d.period}`}
            x={x}
            y={chart.pad.top}
            width={bandW}
            height={chart.innerH}
            fill={hoverIndex === i ? '#e2e8f0' : 'transparent'}
            fillOpacity={hoverIndex === i ? 0.35 : 0}
            onMouseEnter={() => onHover(i)}
            onMouseLeave={() => onHover(null)}
          />
        );
      })}
    </>
  );
}

type ChartLayout = {
  width: number;
  height: number;
  pad: { top: number; right: number; bottom: number; left: number };
  innerW: number;
  innerH: number;
  maxY: number;
  xAt: (i: number) => number;
  yAt: (v: number) => number;
  markerX: number;
  labelY: number;
  labelRotate: number;
  axisFontSize: number;
  labelFontSize: number;
  pointLabelFontSize: number;
  svgClassName: string;
};

function ChartPointValueLabel({
  x,
  y,
  value,
  color,
  fontSize,
}: {
  x: number;
  y: number;
  value: number;
  color: string;
  fontSize: number;
}) {
  const text = chartPointMoneyLabel(value);
  if (!text) return null;
  const labelY = y - 6;
  return (
    <text
      x={x}
      y={labelY}
      textAnchor="middle"
      fontSize={fontSize}
      className="pointer-events-none select-none"
      fill={color}
      stroke="#ffffff"
      strokeWidth={2.5}
      paintOrder="stroke fill"
    >
      {text}
    </text>
  );
}

function LineAreaSeries({
  data,
  series,
  chart,
  chartType,
  activeIndex,
  onHover,
  acceptanceReporting = 'occurrence',
}: {
  data: DashboardCumulativeTrendPoint[];
  series: SeriesDef[];
  chart: ChartLayout;
  chartType: 'line' | 'area';
  activeIndex: number | null;
  onHover: (i: number | null) => void;
  acceptanceReporting?: AcceptanceReportingMode;
}) {
  const parse = parseChartAmount;
  return (
    <>
      {series.map((s) => {
        const points = data
          .map((d, i) =>
            `${chart.xAt(i)},${chart.yAt(parseChartAmount(amountForSeriesKey(d, s.key, acceptanceReporting)))}`,
          )
          .join(' ');
        const areaPoints =
          chartType === 'area'
            ? `${chart.pad.left},${chart.pad.top + chart.innerH} ${points} ${chart.xAt(data.length - 1)},${chart.pad.top + chart.innerH}`
            : '';
        return (
          <g key={s.key}>
            {chartType === 'area' ? (
              <polygon points={areaPoints} fill={s.color} fillOpacity={0.12} />
            ) : null}
            <polyline
              fill="none"
              stroke={s.color}
              strokeWidth={2}
              points={points}
            />
            {data.map((d, i) => {
              const v = parse(amountForSeriesKey(d, s.key, acceptanceReporting));
              const cy = chart.yAt(v);
              return (
                <ChartPointValueLabel
                  key={`${s.key}-lbl-${d.period}`}
                  x={chart.xAt(i)}
                  y={cy}
                  value={v}
                  color={s.color}
                  fontSize={chart.pointLabelFontSize}
                />
              );
            })}
          </g>
        );
      })}
      {series[0]
        ? data.map((d, i) => (
            <circle
              key={d.period}
              cx={chart.xAt(i)}
              cy={chart.yAt(
                parseChartAmount(
                  amountForSeriesKey(d, series[0]!.key, acceptanceReporting),
                ),
              )}
              r={activeIndex === i ? 7 : 4}
              fill="white"
              stroke="#0f172a"
              strokeWidth={1}
              onMouseEnter={() => onHover(i)}
              onMouseLeave={() => onHover(null)}
            />
          ))
        : null}
    </>
  );
}

function ColumnSeries({
  data,
  series,
  chart,
  activeIndex,
  onHover,
  acceptanceReporting = 'occurrence',
}: {
  data: DashboardCumulativeTrendPoint[];
  series: SeriesDef[];
  chart: ChartLayout;
  activeIndex: number | null;
  onHover: (i: number | null) => void;
  acceptanceReporting?: AcceptanceReportingMode;
}) {
  const groupW = chart.innerW / Math.max(data.length, 1);
  const barW = Math.min(18, (groupW / series.length) * 0.85);
  const baseY = chart.pad.top + chart.innerH;

  return (
    <>
      {data.map((d, i) => {
        const gx = chart.pad.left + i * groupW + groupW / 2;
        return series.map((s, si) => {
          const v = parseChartAmount(
            amountForSeriesKey(d, s.key, acceptanceReporting),
          );
          const h = (v / chart.maxY) * chart.innerH;
          const x = gx - (series.length * barW) / 2 + si * barW;
          const y = baseY - h;
          return (
            <g key={`${d.period}-${s.key}`}>
              <rect
                x={x}
                y={y}
                width={barW}
                height={Math.max(h, 0)}
                fill={s.color}
                opacity={activeIndex === i ? 1 : 0.85}
                onMouseEnter={() => onHover(i)}
                onMouseLeave={() => onHover(null)}
              />
              <ChartPointValueLabel
                x={x + barW / 2}
                y={y}
                value={v}
                color={s.color}
                fontSize={chart.pointLabelFontSize}
              />
            </g>
          );
        });
      })}
    </>
  );
}

function buildTooltipPayload(
  point: DashboardCumulativeTrendPoint,
  mode: Mode,
  contractValue?: string,
  acceptanceReporting: AcceptanceReportingMode = 'occurrence',
): FinancialTooltipPayload {
  const planned =
    mode === 'cumulative'
      ? point.plannedAcceptanceCumulative
      : point.plannedAcceptance;
  const actualKey: SeriesKey =
    mode === 'cumulative' ? 'actualAcceptanceCumulative' : 'actualAcceptance';
  const actual = amountForSeriesKey(point, actualKey, acceptanceReporting);
  const collectionKey: SeriesKey =
    mode === 'cumulative'
      ? 'actualCollectionCumulative'
      : 'actualCollection';
  const collected = amountForSeriesKey(
    point,
    collectionKey,
    acceptanceReporting,
  );
  const actualWork =
    mode === 'cumulative'
      ? point.actualWorkCumulative ?? '0'
      : point.actualWork ?? '0';
  const operatingCost =
    mode === 'cumulative'
      ? point.operatingCostCumulative ?? '0'
      : point.operatingCost ?? '0';
  const gap =
    mode === 'cumulative' ? point.acceptanceGap : point.acceptanceGapPeriod;

  let acceptanceProgress: string | undefined;
  if (contractValue) {
    acceptanceProgress = percentOfAmounts(actual, contractValue);
  }

  const acceptanceProgressPeriod =
    parseChartAmount(planned) > 0
      ? percentOfAmounts(actual, planned)
      : point.acceptanceProgressPeriod &&
          parseChartAmount(point.plannedAcceptance) > 0
        ? point.acceptanceProgressPeriod
        : '0.00';

  return {
    month: point.period,
    // Điểm theo đợt: tiêu đề "Đợt 1 · 12/03/2026 → 11/06/2026" thay cho tháng
    title: point.label ? trendPointFullLabel(point) : undefined,
    plannedAcceptance: planned,
    actualAcceptance: actual,
    actualWork:
      parseChartAmount(actualWork) > 0 ? actualWork : undefined,
    acceptanceGap: gap ?? point.acceptanceGap,
    actualCollection: collected,
    operatingCost,
    acceptanceProgress,
    acceptanceProgressPeriod:
      mode === 'period' ? acceptanceProgressPeriod : undefined,
  };
}
