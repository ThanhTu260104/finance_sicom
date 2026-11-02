import type { DashboardQueryParams } from '@/lib/types';
import { parseDashboardQuery, dashboardQueryToSearchParams } from '@/lib/dashboard-filters-url';
import { currentCalendarPeriod } from '@/lib/period';

export type PresentationStep = 1 | 2 | 3 | 4;

export type PresentationUrlState = {
  step: PresentationStep;
  query: DashboardQueryParams;
  projectId?: string;
  contractId?: string;
};

function parseStep(raw: string | null): PresentationStep {
  const n = Number(raw);
  if (n === 2 || n === 3 || n === 4) return n;
  return 1;
}

export function parsePresentationUrl(
  searchParams: URLSearchParams,
): PresentationUrlState {
  const base = parseDashboardQuery(searchParams);
  const step = parseStep(searchParams.get('step'));
  const projectId =
    searchParams.get('projectId') ??
    searchParams.get('explorerProjectId') ??
    undefined;
  const contractId =
    searchParams.get('contractId') ??
    searchParams.get('explorerContractId') ??
    undefined;

  const period =
    base.kpiPeriod?.trim() ||
    base.projectPeriod?.trim() ||
    currentCalendarPeriod();

  const query: DashboardQueryParams = {
    ...base,
    kpiPeriod: period,
    projectPeriod: period,
  };

  return { step, query, projectId, contractId };
}

export function presentationUrlToSearchParams(
  state: PresentationUrlState,
): URLSearchParams {
  const p = dashboardQueryToSearchParams(state.query);
  p.set('step', String(state.step));
  if (state.projectId) p.set('projectId', state.projectId);
  else p.delete('projectId');
  if (state.contractId) p.set('contractId', state.contractId);
  else p.delete('contractId');
  p.delete('explorerProjectId');
  p.delete('explorerContractId');
  return p;
}
