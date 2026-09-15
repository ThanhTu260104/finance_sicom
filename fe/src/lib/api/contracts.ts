import type {
  BillingCycle,
  Contract,
  ContractStatus,
  ContractType,
  PaginatedResponse,
} from '@/lib/types';
import { apiFetch, buildQuery } from './client';

export type ContractListParams = {
  page?: number;
  limit?: number;
  search?: string;
  projectId?: string;
  status?: ContractStatus | '';
  contractType?: ContractType | '';
  billingCycle?: BillingCycle | '';
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
};

export type ContractPayload = {
  projectId: string;
  contractNo: string;
  name: string;
  contractType: ContractType;
  contractValue: number;
  billingCycle: BillingCycle;
  signedDate?: string;
  startDate?: string;
  endDate?: string;
  status?: ContractStatus;
  paymentTermDays?: number;
  note?: string;
};

export type ContractBulkPayload = {
  projectCode: string;
  contractNo: string;
  name: string;
  contractType: ContractType;
  contractValue: number;
  billingCycle: BillingCycle;
  signedDate?: string;
  startDate?: string;
  endDate?: string;
  status?: ContractStatus;
  paymentTermDays?: number;
  note?: string;
};

export const contractsApi = {
  list(params: ContractListParams = {}) {
    return apiFetch<PaginatedResponse<Contract>>(
      `/contracts${buildQuery(params)}`,
    );
  },

  get(id: string) {
    return apiFetch<Contract>(`/contracts/${id}`);
  },

  create(payload: ContractPayload) {
    return apiFetch<Contract>('/contracts', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  bulkUpsert(
    items: ContractBulkPayload[],
    deletedConflictAction?: 'RESTORE' | 'REPLACE',
  ) {
    return apiFetch<{
      count: number;
      created: number;
      updated: number;
      data: Contract[];
    }>('/contracts/bulk', {
      method: 'POST',
      body: JSON.stringify({ items, deletedConflictAction }),
    });
  },

  update(id: string, payload: Partial<ContractPayload>) {
    return apiFetch<Contract>(`/contracts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  remove(id: string) {
    return apiFetch<Contract>(`/contracts/${id}`, { method: 'DELETE' });
  },
};
