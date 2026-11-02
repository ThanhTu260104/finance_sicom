/** Ngày từ Excel kế toán → YYYY-MM-DD (UTC calendar) */
export function parseAccountingDate(raw: string): string {
  const v = raw.trim();
  if (!v || v === '-') return '';

  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;

  const isoLike = /^(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})$/.exec(v);
  if (isoLike) {
    const y = isoLike[1];
    const m = String(Number(isoLike[2])).padStart(2, '0');
    const d = String(Number(isoLike[3])).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  const dmy = /^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/.exec(v);
  if (dmy) {
    const a = Number(dmy[1]);
    const b = Number(dmy[2]);
    const y = dmy[3];
    const day = a > 12 ? a : b;
    const month = a > 12 ? b : a;
    return `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  const parsed = new Date(v);
  if (!Number.isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  return '';
}

export function accountingDateToIso(dateYmd: string): string | undefined {
  if (!dateYmd) return undefined;
  return new Date(`${dateYmd}T00:00:00.000Z`).toISOString();
}
