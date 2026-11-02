import type { DashboardQueryParams } from '@/lib/types';

/** Tham số gọi `/dashboard/overview` — không gồm tháng riêng của chi tiết dự án. */
export function overviewQueryParams(
  query: DashboardQueryParams,
): DashboardQueryParams {
  const {
    projectPeriod: _p,
    explorerProjectId: _e,
    explorerContractId: _c,
    ...rest
  } = query;
  return rest;
}

/** Tham số gọi `/projects/:id/dashboard`. */
export function projectDashboardQueryParams(
  query: DashboardQueryParams,
  projectPeriod?: string,
): DashboardQueryParams {
  const period =
    projectPeriod !== undefined && projectPeriod !== ''
      ? projectPeriod
      : query.projectPeriod;
  return {
    year: query.year,
    fromPeriod: query.fromPeriod,
    toPeriod: query.toPeriod,
    contractStatus: query.contractStatus,
    ...(period ? { projectPeriod: period } : {}),
  };
}

export function overviewQueryKey(query: DashboardQueryParams): string {
  return JSON.stringify(overviewQueryParams(query));
}

export function projectDashboardQueryKey(
  query: DashboardQueryParams,
  projectPeriod?: string,
): string {
  return JSON.stringify(projectDashboardQueryParams(query, projectPeriod));
}

/** Bộ lọc tải chi tiết dự án — không gồm tháng KPI (đổi tháng tính trên FE). */
export function projectDashboardFilterKey(query: DashboardQueryParams): string {
  return JSON.stringify({
    year: query.year,
    fromPeriod: query.fromPeriod,
    toPeriod: query.toPeriod,
    contractStatus: query.contractStatus,
  });
}
