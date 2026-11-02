'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { dashboardApi } from '@/lib/api';
import type {
  DashboardOverviewResponse,
  DashboardQueryParams,
} from '@/lib/types';
import {
  dashboardQueryToSearchParams,
  parseDashboardQuery,
} from '@/lib/dashboard-filters-url';
import {
  overviewQueryKey,
  overviewQueryParams,
} from '@/lib/dashboard-query-slices';
import { DashboardCollapsible } from '@/components/dashboard/company/dashboard-collapsible';
import { formatCurrencyCompactVND } from '@/lib/format';
import { CompanyKpiGrid } from '@/components/dashboard/company/kpi-grid';
import { ProjectSituationTable } from '@/components/dashboard/company/project-table';
import { Button } from '@/components/ui/button';
import { FinancialTimeSeriesChart } from '@/components/dashboard/financial-chart/time-series-chart';
import { companyOverviewChartContext } from '@/components/dashboard/financial-chart/chart-fullscreen-context';
import { ProjectExplorerSection } from '@/components/dashboard/company/project-explorer-section';
import { DashboardActionLists } from '@/components/dashboard/company/dashboard-action-lists';
import { CompanyKpiMonthBreakdown } from '@/components/dashboard/company/company-kpi-month-breakdown';
import { CompanyProjectRevenueReportTable } from '@/components/dashboard/company/company-project-revenue-report-table';
import { CompanyReceivablesMonitorTable } from '@/components/dashboard/company/company-receivables-monitor-table';
import { CompanyCumulativeTrendTable } from '@/components/dashboard/company/company-cumulative-trend-table';

/** Tham số của bộ lọc đã ẩn — bỏ khi đọc URL để luôn xem toàn công ty */
const HIDDEN_FILTER_KEYS = [
  'year',
  'fromPeriod',
  'toPeriod',
  'projectId',
  'customerId',
  'contractStatus',
] as const satisfies ReadonlyArray<keyof DashboardQueryParams>;

export function CompanyDashboardTab({
  includeOperatingCost = false,
  sectionTitle = 'Tổng quan toàn công ty',
}: {
  /** Bật trên dashboard admin; trang chủ ẩn chi phí dự án */
  includeOperatingCost?: boolean;
  sectionTitle?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Bộ lọc trên cùng đã ẩn → luôn xem toàn công ty; bỏ các tham số lọc cũ còn trên URL
  const appliedQuery = useMemo(() => {
    const query = parseDashboardQuery(searchParams);
    for (const key of HIDDEN_FILTER_KEYS) delete query[key];
    return query;
  }, [searchParams]);
  const [overview, setOverview] = useState<DashboardOverviewResponse | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasOverviewRef = useRef(false);
  hasOverviewRef.current = overview != null;

  const overviewQuery = useMemo(
    () => overviewQueryParams(appliedQuery),
    [appliedQuery],
  );
  const overviewKey = useMemo(
    () => overviewQueryKey(appliedQuery),
    [appliedQuery],
  );

  const pushQuery = useCallback(
    (next: DashboardQueryParams) => {
      const p = dashboardQueryToSearchParams(next);
      router.replace(`/?${p.toString()}`, { scroll: false });
    },
    [router],
  );

  const load = useCallback(async () => {
    setError(null);
    if (hasOverviewRef.current) setRefreshing(true);
    else setLoading(true);
    try {
      setOverview(await dashboardApi.overview(overviewQuery));
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Có lỗi khi tải dữ liệu';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [overviewQuery]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [overviewKey, load]);

  const handleKpiPeriodChange = (period: string) => {
    pushQuery({ ...appliedQuery, kpiPeriod: period });
  };

  const kpiPeriodKey =
    appliedQuery.kpiPeriod ??
    overview?.summary?.kpiPeriod ??
    overview?.summary?.currentPeriod ??
    '';

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            {sectionTitle}
          </h2>
          {overview ? (
            <p className="mt-1 text-sm text-slate-600">
              Kỳ hiện tại {overview.summary.currentPeriod} · cập nhật{' '}
              {new Date(overview.summary.asOf).toLocaleString('vi-VN')}
            </p>
          ) : null}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => load()}
          disabled={loading || refreshing}
        >
          <RefreshCw
            className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`}
          />
          Làm mới
        </Button>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {error}
          <Button className="ml-3" size="sm" variant="outline" onClick={() => load()}>
            Thử lại
          </Button>
        </div>
      ) : null}

      {loading && !overview ? (
        <p className="text-sm text-slate-500">Đang tải dữ liệu…</p>
      ) : !overview ? (
        <p className="text-sm text-slate-500">Chưa có dữ liệu</p>
      ) : (
        <div className="space-y-3">
          <DashboardCollapsible
            id="kpi"
            title="Quy mô toàn công ty"
            defaultOpen
            summary={`${overview.summary.contractCount} HĐ · ${formatCurrencyCompactVND(overview.summary.contractValue)}`}
          >
            <CompanyKpiGrid
              summary={overview.summary}
              kpiPeriod={kpiPeriodKey}
              onKpiPeriodChange={handleKpiPeriodChange}
              metricsStale={refreshing}
              includeOperatingCost={includeOperatingCost}
            />
          </DashboardCollapsible>

          {overview.kpiMonthBreakdown ? (
            <DashboardCollapsible
              id="month-breakdown"
              title="Chi tiết kế hoạch thu tiền tháng"
              summary={kpiPeriodKey ? `Tháng ${kpiPeriodKey}` : undefined}
            >
              <CompanyKpiMonthBreakdown
                breakdown={overview.kpiMonthBreakdown}
                kpiPeriod={kpiPeriodKey}
                onKpiPeriodChange={handleKpiPeriodChange}
                metricsStale={refreshing}
                onRefresh={load}
              />
            </DashboardCollapsible>
          ) : null}

          {overview.projectRevenueReport ? (
            <DashboardCollapsible
              id="project-revenue"
              title="Báo cáo doanh thu theo dự án"
              summary={`${overview.byProject.length} dự án`}
            >
              <CompanyProjectRevenueReportTable
                report={overview.projectRevenueReport}
                kpiPeriod={kpiPeriodKey}
                onKpiPeriodChange={handleKpiPeriodChange}
                metricsStale={refreshing}
                includeOperatingCost={includeOperatingCost}
              />
            </DashboardCollapsible>
          ) : null}

          <DashboardCollapsible id="receivables" title="Theo dõi công nợ">
            <CompanyReceivablesMonitorTable
              queryParams={overviewQuery}
              currentPeriod={overview.summary.currentPeriod}
            />
          </DashboardCollapsible>

          <DashboardCollapsible
            id="expiring"
            title="Hợp đồng sắp hết hạn"
            summary={`${(overview.expiringContracts ?? []).length} HĐ`}
          >
            <DashboardActionLists
              expiringContracts={overview.expiringContracts ?? []}
            />
          </DashboardCollapsible>

          <DashboardCollapsible id="trend" title="Tiến độ toàn công ty theo tháng">
            <FinancialTimeSeriesChart
              title="Tiến độ toàn công ty theo tháng"
              data={overview.cumulativeTrend}
              currentPeriod={overview.summary.currentPeriod}
              contractValueForProgress={overview.summary.contractValue}
              fullscreenContext={companyOverviewChartContext(overview.summary)}
              showSeriesToggle
              showChartPeriodFilter
              allowModeSwitch
              defaultChartType="line"
              includeOperatingCost={includeOperatingCost}
            />
          </DashboardCollapsible>

          <DashboardCollapsible id="detail-tables" title="Bảng chi tiết theo tháng & dự án">
            <CompanyCumulativeTrendTable
              embedded
              data={overview.cumulativeTrend}
              currentPeriod={overview.summary.currentPeriod}
              overviewQuery={overviewQuery}
              includeOperatingCost={includeOperatingCost}
            />
            <div>
              <p className="mb-3 text-sm font-semibold text-slate-800">
                Kiểm tra theo dự án
              </p>
              <ProjectSituationTable
                rows={overview.byProject}
                currentPeriod={overview.summary.currentPeriod}
              />
            </div>
          </DashboardCollapsible>

          <DashboardCollapsible
            id="project-explorer"
            title="Chi tiết theo dự án"
            summary={`${overview.byProject.length} dự án`}
          >
            <ProjectExplorerSection
              projects={overview.byProject}
              appliedQuery={appliedQuery}
            />
          </DashboardCollapsible>
        </div>
      )}
    </div>
  );
}
