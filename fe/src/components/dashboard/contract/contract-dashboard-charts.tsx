'use client';

import { useMemo } from 'react';
import type { ContractDashboardResponse, TimelineStatus } from '@/lib/types';
import { FinancialTimeSeriesChart } from '@/components/dashboard/financial-chart/time-series-chart';
import { AtRiskMonthsPanel } from '@/components/dashboard/financial-chart/at-risk-panel';
import { HorizontalPeriodBar } from '@/components/dashboard/shared/horizontal-period-bar';
import { contractDashboardChartContext } from '@/components/dashboard/financial-chart/chart-fullscreen-context';
import { ContractBatchTimelineStrip } from '@/components/contracts/contract-batch-timeline-strip';

function timelineStatusForPeriod(
  period: string,
  currentPeriod: string,
): TimelineStatus {
  if (period < currentPeriod) return 'PAST';
  if (period === currentPeriod) return 'CURRENT';
  return 'FUTURE';
}

export function ContractDashboardCharts({
  data,
  variant = 'full',
}: {
  data: ContractDashboardResponse;
  variant?: 'full' | 'embedded';
}) {
  const showTimeline = variant === 'full';
  const showAtRisk = variant === 'full';
  const chartContext = contractDashboardChartContext(data);
  const billingCycle = data.contract.billingCycle;

  // HĐ nghiệm thu theo chu kỳ (quý, 6 tháng…): mỗi điểm là một đợt NT —
  // KH, NT, thu đều gom theo đợt (không rải theo tháng / ngày NT)
  const batchPoints = data.batchTrend ?? [];
  const byBatch = batchPoints.length > 0;
  const chartData = byBatch ? batchPoints : data.monthlyRows;
  const chartCurrentPeriod = byBatch
    ? (data.currentBatchPeriod ?? undefined)
    : data.summary.currentPeriod;

  const chartPeriods = useMemo(
    () => data.monthlyRows.map((row) => row.period),
    [data.monthlyRows],
  );

  const timelineStatusByPeriod = useMemo(() => {
    const map = new Map<string, TimelineStatus>();
    for (const period of chartPeriods) {
      map.set(
        period,
        timelineStatusForPeriod(period, data.summary.currentPeriod),
      );
    }
    return map;
  }, [chartPeriods, data.summary.currentPeriod]);

  const showAcceptanceBatches = useMemo(
    () => data.monthlyRows.some((row) => row.batchSequence != null),
    [data.monthlyRows],
  );

  return (
    <div className="space-y-6">
      {showTimeline ? (
        <section className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">
            Thời hạn hợp đồng
          </h2>
          <HorizontalPeriodBar
            startDate={data.timeline.startDate}
            endDate={data.timeline.endDate}
            asOf={data.timeline.asOf}
            markerLabel="HÔM NAY"
          />
          {showAcceptanceBatches && chartPeriods.length > 0 ? (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Lịch nghiệm thu theo đợt
              </p>
              <ContractBatchTimelineStrip
                periods={chartPeriods}
                points={data.monthlyRows}
                billingCycle={billingCycle}
                timelineStatusByPeriod={timelineStatusByPeriod}
              />
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">
          S-Curve (lũy kế{byBatch ? ' theo đợt' : ''})
        </h2>
        <FinancialTimeSeriesChart
          title={
            byBatch
              ? 'S-Curve hợp đồng (lũy kế theo đợt)'
              : 'S-Curve hợp đồng (lũy kế)'
          }
          data={chartData}
          currentPeriod={chartCurrentPeriod}
          contractValueForProgress={data.summary.contractValue}
          fullscreenContext={chartContext}
          includeOperatingCost={false}
          showSeriesToggle
          showChartPeriodFilter
          allowModeSwitch
          billingCycle={billingCycle}
          showAcceptanceBatches={!byBatch && showAcceptanceBatches}
          showAcceptanceReportingToggle={!byBatch}
        />
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">
          {byBatch ? 'Tài chính theo đợt nghiệm thu' : 'Tài chính theo tháng'}
        </h2>
        <FinancialTimeSeriesChart
          title={byBatch ? 'Tài chính theo đợt nghiệm thu' : 'Tài chính theo tháng'}
          data={chartData}
          currentPeriod={chartCurrentPeriod}
          mode="period"
          defaultChartType="column"
          contractValueForProgress={data.summary.contractValue}
          fullscreenContext={chartContext}
          includeOperatingCost={false}
          showSeriesToggle
          showChartPeriodFilter
          allowModeSwitch
          billingCycle={billingCycle}
          showAcceptanceBatches={!byBatch && showAcceptanceBatches}
          showAcceptanceReportingToggle={!byBatch}
        />
      </section>

      {showAtRisk ? (
        <section className="space-y-2 rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">
            {byBatch
              ? 'Đợt nghiệm thu thấp hơn kế hoạch'
              : 'Tháng nghiệm thu thấp hơn kế hoạch'}
          </h2>
          <AtRiskMonthsPanel rows={chartData} currentPeriod={chartCurrentPeriod} />
        </section>
      ) : null}
    </div>
  );
}
