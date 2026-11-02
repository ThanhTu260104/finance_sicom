import { BillingCycle } from '@prisma/client';
import { billingCycleToIntervalMonths } from '../contract-acceptance-rounds.util';
import { periodFromVnCalendarDate } from './calendar-date-vn.util';

type PlanWithBatchDates = {
  period: string;
  periodStartDate?: Date | null;
};

/**
 * Tháng hiển thị KH trên bảng chi tiết dashboard (YYYY-MM).
 * Ưu tiên tháng **bắt đầu** khoảng đợt — tránh lệch đợt quý (vd NT 10–12 nhưng period=12).
 */
export function planDashboardMonth(plan: PlanWithBatchDates): string {
  if (plan.periodStartDate && !Number.isNaN(plan.periodStartDate.getTime())) {
    return periodFromVnCalendarDate(plan.periodStartDate);
  }
  return plan.period;
}

/** Chu kỳ 1 tháng: kỳ KH = `plan.period` (trùng NT/acceptance). Chu kỳ >1 tháng: tháng bắt đầu đợt. */
export function planDashboardMonthForBillingCycle(
  plan: PlanWithBatchDates,
  billingCycle: BillingCycle,
): string {
  const interval = billingCycleToIntervalMonths(billingCycle);
  if (interval === 1) {
    return plan.period;
  }
  return planDashboardMonth(plan);
}

export function planMatchesDashboardMonth(
  plan: PlanWithBatchDates,
  dashboardMonth: string,
  billingCycle?: BillingCycle,
): boolean {
  if (billingCycle) {
    return (
      planDashboardMonthForBillingCycle(plan, billingCycle) === dashboardMonth
    );
  }
  return planDashboardMonth(plan) === dashboardMonth;
}
