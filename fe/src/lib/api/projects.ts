import type {
  PaginatedResponse,
  Project,
  ProjectContractCosts,
  ProjectFinanceOverview,
  ProjectStatus,
} from '@/lib/types';
import { apiFetch, buildQuery } from './client';

export type ProjectListParams = {
  page?: number;
  limit?: number;
  search?: string;
  status?: ProjectStatus | '';
  customerId?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
};

export type ProjectPayload = {
  code: string;
  name: string;
  companyId: string;
  customerId?: string;
  projectType?: string;
  location?: string;
  address?: string;
  startDate?: string;
  endDate?: string;
  status?: ProjectStatus;
  description?: string;
  note?: string;
  projectManagerName?: string;
};

export type ProjectBulkPayload = {
  code: string;
  name: string;
  customerCode?: string;
  projectType?: string;
  location?: string;
  address?: string;
  startDate?: string;
  endDate?: string;
  status?: ProjectStatus;
  description?: string;
  note?: string;
  projectManagerName?: string;
};

export const projectsApi = {
  list(params: ProjectListParams = {}) {
    return apiFetch<PaginatedResponse<Project>>(
      `/projects${buildQuery(params)}`,
    );
  },

  get(id: string) {
    return apiFetch<Project>(`/projects/${id}`);
  },

  getFinanceOverview(id: string) {
    return apiFetch<ProjectFinanceOverview>(`/projects/${id}/finance-overview`);
  },

  /** Chi phí thầu phụ / NCC (tổng chi trả theo kỳ) */
  getContractCosts(
    id: string,
    params: { year?: number; fromPeriod?: string; toPeriod?: string } = {},
  ) {
    return apiFetch<ProjectContractCosts>(
      `/projects/${id}/contract-costs${buildQuery(params)}`,
    );
  },

  create(payload: ProjectPayload) {
    return apiFetch<Project>('/projects', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  bulkUpsert(items: ProjectBulkPayload[]) {
    return apiFetch<{
      count: number;
      created: number;
      updated: number;
      data: Project[];
    }>('/projects/bulk', {
      method: 'POST',
      body: JSON.stringify({ items }),
    });
  },

  update(id: string, payload: Partial<ProjectPayload>) {
    return apiFetch<Project>(`/projects/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  remove(id: string) {
    return apiFetch<Project>(`/projects/${id}`, { method: 'DELETE' });
  },
};
