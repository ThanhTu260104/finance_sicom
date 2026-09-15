import type { DashboardOverview } from '@/lib/types';
import { apiFetch } from './client';

export const dashboardApi = {
  overview() {
    return apiFetch<DashboardOverview>('/dashboard/overview');
  },
};
