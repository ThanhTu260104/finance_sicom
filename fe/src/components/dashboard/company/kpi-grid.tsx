'use client';

import type { ReactNode } from 'react';
import type { DashboardOverviewSummary } from '@/lib/types';
import {
  formatCurrencyCompactVND,
  formatCurrencyVND,
  formatPeriod,
} from '@/lib/format';
import { cn } from '@/lib/utils';
import {
  DashboardFilterField,
  DashboardMonthInput,
} from '@/components/dashboard/company/dashboard-panel-header';

function KpiColumn({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col rounded-lg border border-slate-200 bg-white p-4',
        className,
      )}
    >
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
        {title}
      </p>
      <div className="flex flex-1 flex-col gap-4">{children}</div>
    </div>
  );
}

function KpiMetric({
  label,
  value,
  emphasize,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  const display = formatCurrencyCompactVND(value);
  const tooltip = formatCurrencyVND(value);

  return (
    <div title={tooltip}>
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p
        className={cn(
          'mt-0.5 tabular-nums text-slate-900',
          emphasize ? 'text-2xl font-semibold' : 'text-lg font-semibold',
        )}
      >
        {display}
      </p>
    </div>
  );
}

type CompanyKpiGridProps = {
  summary: DashboardOverviewSummary;
  kpiPeriod?: string;
  onKpiPeriodChange?: (period: string) => void;
  showPeriodPicker?: boolean;
  periodPickerLabel?: string;
  periodPickerId?: string;
  /** Đang tải số liệu tháng mới — tránh hiển thị lũy kế/tháng cũ như đúng */
  metricsStale?: boolean;
  includeOperatingCost?: boolean;
};

export function CompanyKpiGrid({
  summary,
  kpiPeriod,
  onKpiPeriodChange,
  showPeriodPicker = false,
  periodPickerLabel = 'Tháng KPI',
  periodPickerId = 'kpi-period',
  metricsStale = false,
  includeOperatingCost = false,
}: CompanyKpiGridProps) {
  const periodKey =
    kpiPeriod?.trim() || summary.kpiPeriod || summary.currentPeriod;
  const period = formatPeriod(periodKey);
  const summaryMatchesPeriod =
    !summary.kpiPeriod || summary.kpiPeriod === periodKey;
  const showStale = metricsStale || !summaryMatchesPeriod;
  const plannedMonth = summary.plannedInCurrentPeriod ?? '0';
  const acceptedMonth = summary.acceptedInCurrentPeriod ?? '0';
  const collectedMonth = summary.collectedInCurrentPeriod ?? '0';
  const gapMonth = summary.acceptanceGapPeriod ?? '0';
  const costMonth = summary.operatingCostInCurrentPeriod;
  const costCumulative = summary.operatingCostToDate;
  const showOperatingCost =
    includeOperatingCost &&
    (costMonth !== undefined || costCumulative !== undefined);

  return (
    <div className="space-y-3">
      {showPeriodPicker && onKpiPeriodChange ? (
        <div className="flex flex-wrap items-end justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3">
          <p className="pb-1 text-xs text-slate-500">
            Kỳ hệ thống hiện tại: {formatPeriod(summary.currentPeriod)}
          </p>
          <DashboardFilterField id={periodPickerId} label={periodPickerLabel}>
            <DashboardMonthInput
              id={periodPickerId}
              value={periodKey}
              onChange={onKpiPeriodChange}
            />
          </DashboardFilterField>
        </div>
      ) : null}

      <div
        className={cn(
          'grid gap-4 lg:grid-cols-3 transition-opacity',
          showStale && 'opacity-60',
        )}
      >
        <KpiColumn title="Quy mô hợp đồng">
          <KpiMetric
            label="Tổng giá trị hợp đồng"
            value={summary.contractValue}
            emphasize
          />
        </KpiColumn>

        <KpiColumn title={`Tháng ${period}`}>
          <KpiMetric label={`Kế hoạch ${period}`} value={plannedMonth} />
          <KpiMetric
            label={`Nghiệm thu thực tế ${period}`}
            value={acceptedMonth}
          />
          <KpiMetric label={`Thu tiền ${period}`} value={collectedMonth} />
          {showOperatingCost ? (
            <KpiMetric
              label={`Chi phí dự án ${period}`}
              value={costMonth ?? '0'}
            />
          ) : null}
          <div className="mt-auto border-t border-slate-100 pt-3">
            <KpiMetric
              label={`Chênh lệch tháng ${period} (KH − NT)`}
              value={gapMonth}
            />
          </div>
        </KpiColumn>

        <KpiColumn title={`Lũy kế đến tháng ${period}`}>
          <KpiMetric
            label={`Lũy kế kế hoạch đến tháng ${period}`}
            value={summary.plannedToDate}
          />
          <KpiMetric
            label={`Nghiệm thu thực tế lũy kế đến tháng ${period}`}
            value={summary.acceptedToDate}
          />
          <KpiMetric
            label={`Thu tiền thực tế đến tháng ${period}`}
            value={summary.collectedToDate}
          />
          {showOperatingCost ? (
            <KpiMetric
              label={`Chi phí dự án lũy kế đến tháng ${period}`}
              value={costCumulative ?? '0'}
            />
          ) : null}
          <div className="mt-auto border-t border-slate-100 pt-3">
            <KpiMetric
              label={`Chênh lệch lũy kế đến tháng ${period} (KH − NT)`}
              value={summary.acceptanceGap}
            />
          </div>
        </KpiColumn>
      </div>
    </div>
  );
}

export function ContractKpiGrid({ summary }: { summary: DashboardOverviewSummary }) {
  return <CompanyKpiGrid summary={summary} />;
}
