import type {
  FinancialControlResponse,
  MonthlyFinancial,
  RevenuePlan,
} from '@/lib/types';
import { apiFetch } from './client';

export type MonthlyFinancialPayload = {
  period: string;
  actualWorkAmount?: number;
  note?: string;
};

export type BulkPlanPayload = {
  generateFromContractDates?: boolean;
  firstPeriodZero?: boolean;
  equalSplit?: boolean;
  items?: Array<{
    period: string;
    plannedAmount: number;
    note?: string;
  }>;
};

export type DraftEqualSplitPayload = {
  periods: string[];
  firstPeriodZero?: boolean;
};

export const financialControlApi = {
  get(contractId: string) {
    return apiFetch<FinancialControlResponse>(
      `/contracts/${contractId}/financial-control`,
    );
  },

  generatePeriods(
    contractId: string,
    payload: {
      useContractDates?: boolean;
      startPeriod?: string;
      endPeriod?: string;
    } = { useContractDates: true },
  ) {
    return apiFetch<{ periods: string[] }>(
      `/contracts/${contractId}/financial-control/generate-periods`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    );
  },

  draftEqualSplit(contractId: string, payload: DraftEqualSplitPayload) {
    return apiFetch<{
      items: Array<{ period: string; plannedAmount: string; note: string | null }>;
      total: string;
      contractValue: string;
    }>(`/contracts/${contractId}/financial-control/draft-equal-split`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  bulkPlans(contractId: string, payload: BulkPlanPayload) {
    return apiFetch<{ count: number; data: RevenuePlan[] }>(
      `/contracts/${contractId}/financial-control/bulk-plans`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    );
  },

  listMonthlyFinancials(contractId: string) {
    return apiFetch<MonthlyFinancial[]>(
      `/contracts/${contractId}/monthly-financials`,
    );
  },

  createMonthlyFinancial(
    contractId: string,
    payload: MonthlyFinancialPayload,
  ) {
    return apiFetch<MonthlyFinancial>(
      `/contracts/${contractId}/monthly-financials`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    );
  },

  updateMonthlyFinancial(
    id: string,
    payload: Partial<Omit<MonthlyFinancialPayload, 'period'>>,
  ) {
    return apiFetch<MonthlyFinancial>(`/monthly-financials/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  removeMonthlyFinancial(id: string) {
    return apiFetch<MonthlyFinancial>(`/monthly-financials/${id}`, {
      method: 'DELETE',
    });
  },
};
