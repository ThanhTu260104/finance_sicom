import type {
  ContractDashboardResponse,
  DashboardOverviewLegacy,
  DashboardOverviewResponse,
  DashboardQueryParams,
  DashboardTimelineQueryParams,
  DashboardTimelineResponse,
  DashboardReceivablesMonitor,
  DashboardTrendProjectPeriodBreakdown,
  OperatingCostTrendResponse,
  ProjectDashboardResponse,
} from '@/lib/types';
import type { OperatingCostTrendParams } from './project-operating-costs';
import { apiFetch, buildQuery } from './client';

export const dashboardApi = {
  trendByProject(
    period: string,
    params: DashboardQueryParams = {},
  ) {
    return apiFetch<DashboardTrendProjectPeriodBreakdown>(
      `/dashboard/trend-by-project${buildQuery({
        period,
        year: params.year,
        fromPeriod: params.fromPeriod,
        toPeriod: params.toPeriod,
        projectId: params.projectId,
        customerId: params.customerId,
        contractStatus: params.contractStatus,
      })}`,
    );
  },

  overview(params: DashboardQueryParams = {}) {
    return apiFetch<DashboardOverviewResponse>(
      `/dashboard/overview${buildQuery({
        year: params.year,
        fromPeriod: params.fromPeriod,
        toPeriod: params.toPeriod,
        kpiPeriod: params.kpiPeriod,
        actionPeriod: params.actionPeriod,
        projectId: params.projectId,
        customerId: params.customerId,
        contractStatus: params.contractStatus,
      })}`,
    );
  },

  receivablesMonitor(params: DashboardQueryParams = {}) {
    return apiFetch<DashboardReceivablesMonitor>(
      `/dashboard/receivables-monitor${buildQuery({
        year: params.year,
        fromPeriod: params.fromPeriod,
        toPeriod: params.toPeriod,
        projectId: params.projectId,
        customerId: params.customerId,
        contractStatus: params.contractStatus,
        receivablesFromPeriod: params.receivablesFromPeriod,
        receivablesToPeriod: params.receivablesToPeriod,
      })}`,
    );
  },

  timeline(params: DashboardTimelineQueryParams = {}) {
    const limit = params.limit != null ? Math.min(params.limit, 100) : undefined;
    return apiFetch<DashboardTimelineResponse>(
      `/dashboard/timeline${buildQuery({
        year: params.year,
        fromPeriod: params.fromPeriod,
        toPeriod: params.toPeriod,
        kpiPeriod: params.kpiPeriod,
        actionPeriod: params.actionPeriod,
        projectId: params.projectId,
        customerId: params.customerId,
        contractStatus: params.contractStatus,
        page: params.page,
        limit,
        sort: params.sort,
        order: params.order,
      })}`,
    );
  },

  /** Gantt: gom nhiều trang, mỗi request limit ≤ 100 (tương thích API @Max(100)). */
  async timelineForGantt(params: DashboardQueryParams = {}) {
    const pageSize = 100;
    const base = {
      ...params,
      limit: pageSize,
      sort: 'endDate' as const,
      order: 'asc' as const,
    };
    const first = await dashboardApi.timeline({ ...base, page: 1 });
    const items = [...first.items];
    const maxPages = Math.min(first.pagination.totalPages, 10);
    for (let page = 2; page <= maxPages; page += 1) {
      const next = await dashboardApi.timeline({ ...base, page });
      items.push(...next.items);
    }
    return {
      ...first,
      items,
      pagination: {
        ...first.pagination,
        page: 1,
        limit: items.length,
        total: first.pagination.total,
        totalPages: 1,
      },
    };
  },

  projectDashboard(projectId: string, params: DashboardQueryParams = {}) {
    return apiFetch<ProjectDashboardResponse>(
      `/projects/${projectId}/dashboard${buildQuery({
        year: params.year,
        fromPeriod: params.fromPeriod,
        toPeriod: params.toPeriod,
        kpiPeriod: params.kpiPeriod,
        projectPeriod: params.projectPeriod,
        contractStatus: params.contractStatus,
      })}`,
    );
  },

  contractDashboard(contractId: string) {
    return apiFetch<ContractDashboardResponse>(
      `/contracts/${contractId}/dashboard`,
    );
  },

  overviewLegacy() {
    return apiFetch<DashboardOverviewLegacy>('/dashboard/overview-legacy');
  },

  operatingCostsTrend(params: OperatingCostTrendParams & DashboardQueryParams = {}) {
    return apiFetch<OperatingCostTrendResponse>(
      `/dashboard/operating-costs-trend${buildQuery({
        year: params.year,
        fromPeriod: params.fromPeriod,
        toPeriod: params.toPeriod,
        kpiPeriod: params.kpiPeriod,
        actionPeriod: params.actionPeriod,
        projectId: params.projectId,
        customerId: params.customerId,
      })}`,
    );
  },
};
