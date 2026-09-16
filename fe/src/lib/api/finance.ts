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
  period: string;
  plannedAmount: number;
  note?: string;
};

export type AcceptancePayload = {
  scheduleId?: string;
  acceptanceNo: string;
  period: string;
  acceptanceDate?: string;
  invoiceNo?: string;
  invoiceDate?: string;
  amount: number;
  status?: AcceptanceStatus;
  documentStatus?: DocumentStatus;
  paymentStatus?: AcceptancePaymentStatus;
  note?: string;
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
