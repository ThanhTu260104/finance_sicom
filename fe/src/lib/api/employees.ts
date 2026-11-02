import type { Employee, EmployeeStatus, PaginatedResponse } from '@/lib/types';
import { apiFetch, buildQuery } from './client';

export type EmployeeListParams = {
  page?: number;
  limit?: number;
  search?: string;
  status?: EmployeeStatus | '';
};

export type EmployeePayload = {
  code: string;
  fullName: string;
  jobTitle?: string;
  status?: EmployeeStatus;
  note?: string;
};

const MAX_PAGE_SIZE = 100;

export const employeesApi = {
  list(params: EmployeeListParams = {}) {
    const limit = Math.min(params.limit ?? 10, MAX_PAGE_SIZE);
    return apiFetch<PaginatedResponse<Employee>>(
      `/employees${buildQuery({ ...params, limit })}`,
    );
  },

  /** Lấy hết trang (mỗi request tối đa 100 dòng theo API). */
  async listAll(
    params: Omit<EmployeeListParams, 'page' | 'limit'> = {},
  ): Promise<Employee[]> {
    const limit = MAX_PAGE_SIZE;
    let page = 1;
    const out: Employee[] = [];
    for (;;) {
      const res = await apiFetch<PaginatedResponse<Employee>>(
        `/employees${buildQuery({ ...params, page, limit })}`,
      );
      out.push(...res.data);
      if (page >= res.meta.totalPages) break;
      page += 1;
    }
    return out;
  },

  get(id: string) {
    return apiFetch<Employee>(`/employees/${id}`);
  },

  create(payload: EmployeePayload) {
    return apiFetch<Employee>('/employees', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  bulkUpsert(items: EmployeePayload[]) {
    return apiFetch<{
      count: number;
      created: number;
      updated: number;
      data: Employee[];
    }>('/employees/bulk', {
      method: 'POST',
      body: JSON.stringify({ items }),
    });
  },

  update(id: string, payload: Partial<EmployeePayload>) {
    return apiFetch<Employee>(`/employees/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  remove(id: string) {
    return apiFetch<Employee>(`/employees/${id}`, {
      method: 'DELETE',
    });
  },
};
