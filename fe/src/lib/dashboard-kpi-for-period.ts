import type {
  DashboardCumulativeTrendPoint,
  DashboardOverviewSummary,
} from '@/lib/types';

/** Gắn số liệu tháng / lũy kế từ S-curve theo tháng người dùng chọn. */
export function applyKpiPeriodToSummary(
  summary: DashboardOverviewSummary,
  trend: DashboardCumulativeTrendPoint[],
  period: string,
): DashboardOverviewSummary {
  const key = period?.trim();
  if (!key || trend.length === 0) {
    return { ...summary, kpiPeriod: key || summary.kpiPeriod };
  }

  const monthRow = trend.find((row) => row.period === key);
  let cumulativeRow: DashboardCumulativeTrendPoint | undefined;
  for (const row of trend) {
    if (row.period <= key) cumulativeRow = row;
    else break;
  }

  return {
    ...summary,
    kpiPeriod: key,
    plannedInCurrentPeriod: monthRow?.plannedAcceptance ?? '0',
    acceptedInCurrentPeriod: monthRow?.actualAcceptance ?? '0',
    collectedInCurrentPeriod: monthRow?.actualCollection ?? '0',
    acceptanceGapPeriod: monthRow?.acceptanceGapPeriod ?? '0',
    plannedToDate: cumulativeRow?.plannedAcceptanceCumulative ?? '0',
    acceptedToDate: cumulativeRow?.actualAcceptanceCumulative ?? '0',
    collectedToDate: cumulativeRow?.actualCollectionCumulative ?? '0',
    acceptanceGap: cumulativeRow?.acceptanceGap ?? '0',
  };
}
