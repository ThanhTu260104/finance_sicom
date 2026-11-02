import type { CostCategory, EmployeeStatus, PaginatedResponse } from '@/lib/types';
import { apiFetch, buildQuery } from './client';

export type CostCategoryListParams = {
  page?: number;
  limit?: number;
  search?: string;
  status?: EmployeeStatus | '';
};

export type CostCategoryPayload = {
  code: string;
  name: string;
  sortOrder?: number;
  status?: EmployeeStatus;
  note?: string;
};

const MAX_PAGE_SIZE = 100;

export const costCategoriesApi = {
  list(params: CostCategoryListParams = {}) {
    const limit = Math.min(params.limit ?? 10, MAX_PAGE_SIZE);
    return apiFetch<PaginatedResponse<CostCategory>>(
      `/cost-categories${buildQuery({ ...params, limit })}`,
    );
  },

  async listAll(
    params: Omit<CostCategoryListParams, 'page' | 'limit'> = {},
  ): Promise<CostCategory[]> {
    let page = 1;
    const out: CostCategory[] = [];
    for (;;) {
      const res = await costCategoriesApi.list({
        ...params,
        page,
        limit: MAX_PAGE_SIZE,
      });
      out.push(...res.data);
      if (page >= res.meta.totalPages) break;
      page += 1;
    }
    return out;
  },

  create(payload: CostCategoryPayload) {
    return apiFetch<CostCategory>('/cost-categories', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  bulkUpsert(items: CostCategoryPayload[]) {
    return apiFetch<{
      count: number;
      created: number;
      updated: number;
      data: CostCategory[];
    }>('/cost-categories/bulk', {
      method: 'POST',
      body: JSON.stringify({ items }),
    });
  },

  update(id: string, payload: Partial<CostCategoryPayload>) {
    return apiFetch<CostCategory>(`/cost-categories/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  remove(id: string) {
    return apiFetch<CostCategory>(`/cost-categories/${id}`, {
      method: 'DELETE',
    });
  },
};
