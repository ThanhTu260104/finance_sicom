import type {
  OperatingCostTrendResponse,
  ProjectOperatingCost,
} from '@/lib/types';
import { apiFetch, buildQuery } from './client';

export type OperatingCostListParams = {
  period?: string;
  fromPeriod?: string;
  toPeriod?: string;
  year?: number;
};

export type OperatingCostTrendParams = {
  year?: number;
  fromPeriod?: string;
  toPeriod?: string;
};

export type OperatingCostPayload = {
  period: string;
  categoryId?: string;
  categoryCode?: string;
  title?: string;
  amount: number;
  note?: string;
};

export const projectOperatingCostsApi = {
  list(projectId: string, params: OperatingCostListParams = {}) {
    return apiFetch<ProjectOperatingCost[]>(
      `/projects/${projectId}/operating-costs${buildQuery(params)}`,
    );
  },

  trend(projectId: string, params: OperatingCostTrendParams = {}) {
    return apiFetch<OperatingCostTrendResponse>(
      `/projects/${projectId}/operating-costs/trend${buildQuery(params)}`,
    );
  },

  listPeriods(projectId: string) {
    return apiFetch<string[]>(
      `/projects/${projectId}/operating-costs/periods`,
    );
  },

  create(projectId: string, payload: OperatingCostPayload) {
    return apiFetch<ProjectOperatingCost>(
      `/projects/${projectId}/operating-costs`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    );
  },

  bulkCreate(projectId: string, items: OperatingCostPayload[]) {
    return apiFetch<{ count: number; data: ProjectOperatingCost[] }>(
      `/projects/${projectId}/operating-costs/bulk`,
      {
        method: 'POST',
        body: JSON.stringify({ items }),
      },
    );
  },

  update(id: string, payload: Partial<OperatingCostPayload>) {
    return apiFetch<ProjectOperatingCost>(`/project-operating-costs/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  remove(id: string) {
    return apiFetch<ProjectOperatingCost>(`/project-operating-costs/${id}`, {
      method: 'DELETE',
    });
  },
};
