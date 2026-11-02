import type {
  BillingCycle,
  Contract,
  ContractKind,
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
  /** Mặc định server chỉ trả HĐ CĐT; 'ALL' = mọi loại */
  kind?: ContractKind | 'ALL';
  companyId?: string;
  counterpartyId?: string;
  status?: ContractStatus | '';
  contractType?: ContractType | '';
  billingCycle?: BillingCycle | '';
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
};

export type ContractPayload = {
  projectId: string;
  kind?: ContractKind;
  companyId?: string | null;
  counterpartyId?: string | null;
  contractNo: string;
  name: string;
  contractType: string;
  contractValue: number;
  billingCycle: BillingCycle;
  signedDate?: string;
  startDate?: string;
  endDate?: string;
  status?: ContractStatus;
  paymentTermDays?: number;
  durationYears?: number;
  note?: string;
};

export type ContractBulkPayload = {
  projectCode: string;
  companyCode?: string;
  counterpartyCode?: string;
  contractNo: string;
  name: string;
  contractType: string;
  contractValue: number;
  billingCycle: BillingCycle;
  signedDate?: string;
  startDate?: string;
  endDate?: string;
  status?: ContractStatus;
  paymentTermDays?: number;
  durationYears?: number;
  note?: string;
};

export type ContractImportLookupRow = {
  contractNo: string;
  projectCode: string | null;
};

export type ContractOverviewStatistics = {
  customerCount: number;
  contractCount: number;
  operationContractCount: number;
  maintenanceContractCount: number;
};

export type MaintenanceDailyGridContract = {
  id: string;
  contractNo: string;
  name: string;
  status: ContractStatus;
  project: { code: string; name: string };
};

export type MaintenanceDailyGridResponse = {
  period: string;
  workDates: string[];
  contracts: MaintenanceDailyGridContract[];
  amounts: Record<string, string>;
  rowTotals: Record<string, string>;
};

export const contractsApi = {
  list(params: ContractListParams = {}) {
    return apiFetch<PaginatedResponse<Contract>>(
      `/contracts${buildQuery(params)}`,
    );
  },

  importLookup() {
    return apiFetch<ContractImportLookupRow[]>('/contracts/import-lookup');
  },

  overviewStatistics() {
    return apiFetch<ContractOverviewStatistics>(
      '/contracts/overview/statistics',
    );
  },

  maintenanceDailyGrid(period: string) {
    return apiFetch<MaintenanceDailyGridResponse>(
      `/contracts/maintenance-daily${buildQuery({ period })}`,
    );
  },

  maintenanceDailyBulk(payload: {
    period: string;
    items: Array<{
      contractId: string;
      workDate: string;
      amount: number;
    }>;
  }) {
    return apiFetch<{ count: number }>('/contracts/maintenance-daily/bulk', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
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
    kind: ContractKind = 'INVESTOR',
  ) {
    return apiFetch<{
      count: number;
      created: number;
      updated: number;
      data: Contract[];
    }>('/contracts/bulk', {
      method: 'POST',
      body: JSON.stringify({ items, deletedConflictAction, kind }),
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
