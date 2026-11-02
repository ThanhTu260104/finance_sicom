/** Lùi / tiến n tháng từ kỳ YYYY-MM */
export function shiftPeriodMonths(period: string, deltaMonths: number): string {
  const [y, m] = period.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + deltaMonths, 1));
  const yy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${yy}-${mm}`;
}
