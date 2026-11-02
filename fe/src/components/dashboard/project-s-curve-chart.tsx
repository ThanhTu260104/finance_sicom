'use client';

import type { ProjectDashboardResponse } from '@/lib/types';
import { batchOrMonthlyChartData } from '@/lib/batch-chart-data';
import { FinancialTimeSeriesChart } from '@/components/dashboard/financial-chart/time-series-chart';
import { projectDashboardChartContext } from '@/components/dashboard/financial-chart/chart-fullscreen-context';

/** S-Curve dự án — theo đợt NT khi dự án có lịch đợt chung, ngược lại theo tháng */
export function ProjectSCurveChart({
  detail,
}: {
  detail: ProjectDashboardResponse;
}) {
  const chart = batchOrMonthlyChartData({
    batchTrend: detail.batchTrend,
    currentBatchPeriod: detail.currentBatchPeriod,
    monthly: detail.cumulativeTrend,
    currentPeriod: detail.summary.currentPeriod,
  });
  return (
    <FinancialTimeSeriesChart
      title={chart.byBatch ? 'S-Curve dự án (theo đợt)' : 'S-Curve dự án'}
      data={chart.data}
      currentPeriod={chart.currentPeriod}
      contractValueForProgress={detail.summary.contractValue}
      fullscreenContext={projectDashboardChartContext(detail)}
      showSeriesToggle
      showChartPeriodFilter
      allowModeSwitch
    />
  );
}
