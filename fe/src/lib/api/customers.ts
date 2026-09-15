import type { Customer, CustomerStatus, PaginatedResponse } from '@/lib/types';
import { apiFetch, buildQuery } from './client';

export type CustomerListParams = {
  page?: number;
  limit?: number;
  search?: string;
  status?: CustomerStatus | '';
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
};

export type CustomerPayload = {
  code: string;
  name: string;
  taxCode?: string;
  address?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  status?: CustomerStatus;
  note?: string;
};

export const customersApi = {
  list(params: CustomerListParams = {}) {
    return apiFetch<PaginatedResponse<Customer>>(
      `/customers${buildQuery(params)}`,
    );
  },

  get(id: string) {
    return apiFetch<Customer>(`/customers/${id}`);
  },

  create(payload: CustomerPayload) {
    return apiFetch<Customer>('/customers', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  bulkUpsert(items: CustomerPayload[]) {
    return apiFetch<{
      count: number;
      created: number;
      updated: number;
      data: Customer[];
    }>('/customers/bulk', {
      method: 'POST',
      body: JSON.stringify({ items }),
    });
  },

  update(id: string, payload: Partial<CustomerPayload>) {
    return apiFetch<Customer>(`/customers/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  remove(id: string) {
    return apiFetch<Customer>(`/customers/${id}`, { method: 'DELETE' });
  },
};
