import type { BillingCycle } from '@/lib/types';
import { billingCycleToIntervalMonths } from '@/lib/contract-duration';

/** HĐ NT > 1 tháng/lần → KH tách tháng con (UI ul/li, đợt 2-2). */
export function billingCycleUsesMonthlyPlanBreakdown(
  cycle: BillingCycle,
): boolean {
  const months = billingCycleToIntervalMonths(cycle);
  return months != null && months > 1;
}
