import type { Company, CustomerStatus, PaginatedResponse } from '@/lib/types';
import { apiFetch, buildQuery } from './client';

export type CompanyListParams = {
  page?: number;
  limit?: number;
  search?: string;
  status?: CustomerStatus | '';
};

export type CompanyPayload = {
  code: string;
  name: string;
  taxCode?: string;
  address?: string;
  status?: CustomerStatus;
  note?: string;
};

export const companiesApi = {
  list(params: CompanyListParams = {}) {
    return apiFetch<PaginatedResponse<Company>>(
      `/companies${buildQuery(params)}`,
    );
  },

  get(id: string) {
    return apiFetch<Company>(`/companies/${id}`);
  },

  create(payload: CompanyPayload) {
    return apiFetch<Company>('/companies', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  update(id: string, payload: Partial<CompanyPayload>) {
    return apiFetch<Company>(`/companies/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  remove(id: string) {
    return apiFetch<Company>(`/companies/${id}`, { method: 'DELETE' });
  },
};
