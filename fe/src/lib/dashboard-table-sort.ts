import { useCallback, useState } from 'react';
import { compareDecimalStrings } from '@/lib/format';

type MoneyRow = {
  plannedAmount: string;
  actualAcceptance: string;
  collectedAmount: string;
};

/** Ưu tiên dòng có số tiền lớn (kế hoạch / NT / thu) lên đầu — mặc định cũ. */
export function sortKpiBreakdownRows<T extends MoneyRow>(rows: T[]): T[] {
  const weight = (row: MoneyRow) => {
    const values = [
      row.plannedAmount,
      row.actualAcceptance,
      row.collectedAmount,
    ];
    return values.reduce(
      (best, cur) => (compareDecimalStrings(cur, best) > 0 ? cur : best),
      '0',
    );
  };

  return [...rows].sort((a, b) => {
    const byWeight = compareDecimalStrings(weight(b), weight(a));
    if (byWeight !== 0) return byWeight;
    return compareDecimalStrings(b.plannedAmount, a.plannedAmount);
  });
}

export type DashboardSortKind = 'decimal' | 'period' | 'locale' | 'number';

export type DashboardTableSortState<K extends string = string> = {
  key: K;
  desc: boolean;
};

export function compareDashboardSortValues(
  a: string | number | null | undefined,
  b: string | number | null | undefined,
  kind: DashboardSortKind,
): number {
  if (kind === 'number') {
    const na = a == null || a === '' ? NaN : Number(a);
    const nb = b == null || b === '' ? NaN : Number(b);
    const fa = Number.isFinite(na) ? na : -Infinity;
    const fb = Number.isFinite(nb) ? nb : -Infinity;
    if (fa === fb) return 0;
    return fa > fb ? 1 : -1;
  }

  const sa = a == null ? '' : String(a).trim();
  const sb = b == null ? '' : String(b).trim();

  if (kind === 'locale') {
    return sa.localeCompare(sb, 'vi');
  }
  if (kind === 'period') {
    return sa.localeCompare(sb);
  }
  return compareDecimalStrings(sa || '0', sb || '0');
}

export function sortDashboardRows<T, K extends string>(
  rows: T[],
  sort: DashboardTableSortState<K>,
  getValue: (row: T, key: K) => string | number | null | undefined,
  kindForKey: (key: K) => DashboardSortKind = () => 'decimal',
): T[] {
  const dir = sort.desc ? -1 : 1;
  const kind = kindForKey(sort.key);
  return [...rows].sort((a, b) => {
    const cmp = compareDashboardSortValues(
      getValue(a, sort.key),
      getValue(b, sort.key),
      kind,
    );
    if (cmp !== 0) return cmp * dir;
    return 0;
  });
}

export function useDashboardTableSort<K extends string>(
  defaultKey: K,
  defaultDesc = true,
) {
  const [sort, setSort] = useState<DashboardTableSortState<K>>({
    key: defaultKey,
    desc: defaultDesc,
  });

  const toggleSort = useCallback((key: K) => {
    setSort((prev) =>
      prev.key === key
        ? { key, desc: !prev.desc }
        : { key, desc: true },
    );
  }, []);

  return { sort, toggleSort };
}
