import type {
  FinancialControlResponse,
  MonthlyFinancial,
  RevenuePlan,
} from '@/lib/types';
import type { RevenuePlanPayload } from '@/lib/api/finance';
import { apiFetch } from './client';

export type MonthlyFinancialPayload = {
  period: string;
  actualWorkAmount?: number;
  note?: string;
};

export type BulkPlanPayload = {
  generateFromContractDates?: boolean;
  generateFromAcceptanceSchedule?: boolean;
  replaceExisting?: boolean;
  firstPeriodZero?: boolean;
  equalSplit?: boolean;
  startPeriod?: string;
  endPeriod?: string;
  items?: RevenuePlanPayload[];
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
      useAcceptanceSchedule?: boolean;
      startPeriod?: string;
      endPeriod?: string;
    } = { useContractDates: true },
  ) {
    return apiFetch<{
      periods: string[];
      acceptanceRounds?: number | null;
      contractValue?: string;
    }>(
      `/contracts/${contractId}/financial-control/generate-periods`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    );
  },

  draftEqualSplit(contractId: string, payload: DraftEqualSplitPayload) {
    return apiFetch<{
      items: Array<{
        period: string;
        plannedAmount: string;
        note: string | null;
        batchSequence?: number | null;
        periodStartDate?: string | null;
        periodEndDate?: string | null;
      }>;
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
