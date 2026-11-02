import type { ContractStatus } from '@/lib/types';
import type { DashboardQueryParams, DashboardTimelineQueryParams } from '@/lib/types';

export function parseDashboardQuery(
  searchParams: URLSearchParams,
): DashboardQueryParams {
  const yearRaw = searchParams.get('year');
  const year = yearRaw ? Number(yearRaw) : undefined;
  return {
    year: Number.isFinite(year) ? year : undefined,
    fromPeriod: searchParams.get('fromPeriod') ?? undefined,
    toPeriod: searchParams.get('toPeriod') ?? undefined,
    kpiPeriod: searchParams.get('kpiPeriod') ?? undefined,
    actionPeriod: searchParams.get('actionPeriod') ?? undefined,
    projectPeriod: searchParams.get('projectPeriod') ?? undefined,
    explorerProjectId: searchParams.get('explorerProjectId') ?? undefined,
    explorerContractId: searchParams.get('explorerContractId') ?? undefined,
    projectId: searchParams.get('projectId') ?? undefined,
    customerId: searchParams.get('customerId') ?? undefined,
    contractStatus:
      (searchParams.get('contractStatus') as ContractStatus | null) ?? undefined,
    receivablesFromPeriod:
      searchParams.get('receivablesFromPeriod') ?? undefined,
    receivablesToPeriod: searchParams.get('receivablesToPeriod') ?? undefined,
  };
}

export function parseTimelineQuery(
  searchParams: URLSearchParams,
): DashboardTimelineQueryParams {
  const base = parseDashboardQuery(searchParams);
  const page = Number(searchParams.get('page') ?? '1');
  const limit = Number(searchParams.get('limit') ?? '30');
  return {
    ...base,
    page: Number.isFinite(page) && page > 0 ? page : 1,
    limit: Number.isFinite(limit) && limit > 0 ? Math.min(limit, 100) : 30,
    sort:
      (searchParams.get('sort') as DashboardTimelineQueryParams['sort']) ??
      'acceptanceGap',
    order:
      (searchParams.get('order') as 'asc' | 'desc' | null) ?? 'desc',
  };
}

export function dashboardQueryToSearchParams(
  query: DashboardQueryParams,
): URLSearchParams {
  const p = new URLSearchParams();
  if (query.year) p.set('year', String(query.year));
  if (query.fromPeriod) p.set('fromPeriod', query.fromPeriod);
  if (query.toPeriod) p.set('toPeriod', query.toPeriod);
  if (query.kpiPeriod) p.set('kpiPeriod', query.kpiPeriod);
  if (query.actionPeriod) p.set('actionPeriod', query.actionPeriod);
  if (query.projectPeriod) p.set('projectPeriod', query.projectPeriod);
  if (query.explorerProjectId) {
    p.set('explorerProjectId', query.explorerProjectId);
  }
  if (query.explorerContractId) {
    p.set('explorerContractId', query.explorerContractId);
  }
  if (query.projectId) p.set('projectId', query.projectId);
  if (query.customerId) p.set('customerId', query.customerId);
  if (query.contractStatus) p.set('contractStatus', query.contractStatus);
  if (query.receivablesFromPeriod) {
    p.set('receivablesFromPeriod', query.receivablesFromPeriod);
  }
  if (query.receivablesToPeriod) {
    p.set('receivablesToPeriod', query.receivablesToPeriod);
  }
  return p;
}

/** URL dashboard công ty giữ bộ lọc + dự án/HĐ đang xem (quay lại từ trang HĐ). */
export function buildCompanyDashboardReturnUrl(
  query: DashboardQueryParams,
): string {
  const params = dashboardQueryToSearchParams(query);
  const qs = params.toString();
  return qs ? `/?${qs}` : '/';
}

export function encodeDashboardReturnUrl(url: string): string {
  return encodeURIComponent(url);
}

export function decodeDashboardReturnUrl(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const decoded = decodeURIComponent(raw);
    if (!decoded.startsWith('/')) return null;
    return decoded;
  } catch {
    return null;
  }
}
