/** Generate YYYY-MM periods from start (inclusive) to end (inclusive) by calendar month. */
export function generatePeriodsBetween(
  startDate: Date,
  endDate: Date,
): string[] {
  const periods: string[] = [];
  const cursor = new Date(
    Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), 1),
  );
  const end = new Date(
    Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), 1),
  );

  while (cursor <= end) {
    const year = cursor.getUTCFullYear();
    const month = String(cursor.getUTCMonth() + 1).padStart(2, '0');
    periods.push(`${year}-${month}`);
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  return periods;
}

export function formatPeriodLabel(period: string, index: number): string {
  return `T${index + 1}`;
}
