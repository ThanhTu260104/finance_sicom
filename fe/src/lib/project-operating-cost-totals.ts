import type { ProjectOperatingCost } from '@/lib/types';

export function parseCostAmount(
  value: string | number | null | undefined,
): number {
  if (value === null || value === undefined || value === '') return 0;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function sumOperatingCosts(items: ProjectOperatingCost[]): number {
  return items.reduce((sum, row) => sum + parseCostAmount(row.amount), 0);
}
