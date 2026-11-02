import type { DashboardCumulativeTrendPoint } from '@/lib/types';

/**
 * Dữ liệu biểu đồ HĐ / dự án: có lịch đợt → một điểm mỗi đợt NT
 * ("Đợt 1 (12/03/2026 - 11/06/2026)"); không có (dự án nhiều HĐ khác lịch) → theo tháng.
 */
export function batchOrMonthlyChartData(source: {
  batchTrend?: DashboardCumulativeTrendPoint[];
  currentBatchPeriod?: string | null;
  monthly: DashboardCumulativeTrendPoint[];
  currentPeriod: string;
}): {
  data: DashboardCumulativeTrendPoint[];
  currentPeriod: string | undefined;
  byBatch: boolean;
} {
  const batches = source.batchTrend ?? [];
  if (batches.length > 0) {
    return {
      data: batches,
      currentPeriod: source.currentBatchPeriod ?? undefined,
      byBatch: true,
    };
  }
  return {
    data: source.monthly,
    currentPeriod: source.currentPeriod,
    byBatch: false,
  };
}
