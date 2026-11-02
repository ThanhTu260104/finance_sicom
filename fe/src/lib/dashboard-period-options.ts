import { buildPeriodOptions } from '@/components/shared/csv-data-transfer';

/** Kỳ cho dropdown legacy (CSV…) — phạm vi rộng. */
export function dashboardPeriodValues() {
  const year = new Date().getFullYear();
  return buildPeriodOptions(year - 15, year + 15).map((o) => o.value);
}

export function defaultDashboardFromPeriod() {
  const now = new Date();
  return `${now.getFullYear()}-01`;
}

export function defaultDashboardToPeriod() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}
