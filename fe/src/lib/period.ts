/** Kỳ hiện tại YYYY-MM (theo lịch máy client). */
export function currentCalendarPeriod(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}
