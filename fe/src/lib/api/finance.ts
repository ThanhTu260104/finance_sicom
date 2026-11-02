import type {
  Acceptance,
  AcceptancePaymentStatus,
  AcceptanceStatus,
  ContractFinanceSummary,
  DocumentStatus,
  RevenuePlan,
  AcceptanceSchedule,
  AcceptanceScheduleMethod,
} from '@/lib/types';
import { apiFetch } from './client';

export type RevenuePlanPayload = {
  period?: string;
  batchSequence?: number;
  periodStartDate?: string;
  periodEndDate?: string;
  scheduleId?: string;
  plannedAmount: number;
  plannedAcceptanceDate?: string;
  note?: string;
};

export type AcceptancePayload = {
  scheduleId?: string;
  revenuePlanId?: string;
  acceptanceNo: string;
  period: string;
  acceptanceDate?: string;
  invoiceNo?: string;
  invoiceDate?: string;
  /** null = xóa ngày thu tiền khi sửa */
  paymentDate?: string | null;
  amount: number;
  status?: AcceptanceStatus;
  documentStatus?: DocumentStatus;
  paymentStatus?: AcceptancePaymentStatus;
  note?: string;
};

/** Dòng import từ file kế toán NT/thu */
export type AccountingImportItem = AcceptancePayload & {
  contractNo: string;
  projectCode?: string;
};

export type AccountingImportResult = {
  created: number;
  updated: number;
  failed: number;
  errors: Array<{
    contractNo: string;
    acceptanceNo: string;
    message: string;
  }>;
  warnings: Array<{ contractNo: string; message: string }>;
};

export type AcceptanceSchedulePayload = {
  sequence: number;
  name: string;
  startPeriod?: string;
  endPeriod?: string;
  dueDate?: string;
  method: AcceptanceScheduleMethod;
  plannedAmount?: number;
  percentOfContract?: number;
  plannedQuantity?: number;
  actualQuantity?: number;
  unit?: string;
  note?: string;
};

export const acceptanceSchedulesApi = {
  list(contractId: string) { return apiFetch<AcceptanceSchedule[]>(`/contracts/${contractId}/acceptance-schedules`); },
  create(contractId: string, payload: AcceptanceSchedulePayload) { return apiFetch<AcceptanceSchedule>(`/contracts/${contractId}/acceptance-schedules`, { method: 'POST', body: JSON.stringify(payload) }); },
  update(id: string, payload: Partial<AcceptanceSchedulePayload>) { return apiFetch<AcceptanceSchedule>(`/acceptance-schedules/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }); },
  remove(id: string) { return apiFetch<AcceptanceSchedule>(`/acceptance-schedules/${id}`, { method: 'DELETE' }); },
};

export const revenuePlansApi = {
  list(contractId: string) {
    return apiFetch<ContractFinanceSummary>(
      `/contracts/${contractId}/revenue-plans`,
    );
  },

  create(contractId: string, payload: RevenuePlanPayload) {
    return apiFetch<RevenuePlan>(`/contracts/${contractId}/revenue-plans`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  update(id: string, payload: Partial<RevenuePlanPayload>) {
    return apiFetch<RevenuePlan>(`/revenue-plans/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  remove(id: string) {
    return apiFetch<RevenuePlan>(`/revenue-plans/${id}`, { method: 'DELETE' });
  },
};

export const acceptancesApi = {
  list(contractId: string) {
    return apiFetch<Acceptance[]>(`/contracts/${contractId}/acceptances`);
  },

  get(id: string) {
    return apiFetch<Acceptance>(`/acceptances/${id}`);
  },

  create(contractId: string, payload: AcceptancePayload) {
    return apiFetch<Acceptance>(`/contracts/${contractId}/acceptances`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  bulkUpsert(contractId: string, items: AcceptancePayload[]) {
    return apiFetch<{
      count: number;
      created: number;
      updated: number;
      data: Acceptance[];
    }>(`/contracts/${contractId}/acceptances/bulk`, {
      method: 'POST',
      body: JSON.stringify({ items }),
    });
  },

  importAccounting(
    items: AccountingImportItem[],
    options?: { onlyContractNo?: string },
  ) {
    return apiFetch<AccountingImportResult>(
      '/acceptances/import-accounting',
      {
        method: 'POST',
        body: JSON.stringify({
          items,
          onlyContractNo: options?.onlyContractNo,
        }),
      },
    );
  },

  update(id: string, payload: Partial<AcceptancePayload>) {
    return apiFetch<Acceptance>(`/acceptances/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  remove(id: string) {
    return apiFetch<Acceptance>(`/acceptances/${id}`, { method: 'DELETE' });
  },
};
