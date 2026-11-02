import type { Project } from '@/lib/types';

const EMPTY_PM_MARKERS = new Set(['—', '–', '-', 'n/a', 'na', 'null', 'none']);

/** Giá trị trống / placeholder (export hoặc Excel) — không ghi DB. */
export function normalizeProjectManagerImportValue(
  value?: string | null,
): string | undefined {
  const v = value?.trim();
  if (!v) return undefined;
  if (EMPTY_PM_MARKERS.has(v.toLowerCase())) return undefined;
  return v;
}

/** Trưởng dự án: ưu tiên API list, fallback ghi chú vai trò Quản lý dự án. */
export function projectManagerDisplay(project: Project): string {
  const fromApi = normalizeProjectManagerImportValue(
    project.projectManagerName,
  );
  if (fromApi) return fromApi;
  const pm = project.assignments?.find((a) => a.role === 'PROJECT_MANAGER');
  const note = normalizeProjectManagerImportValue(pm?.note);
  return note || '—';
}

/** Tên trưởng dự án để xuất Excel (không dùng dấu —). */
export function projectManagerExportValue(project: Project): string {
  return projectManagerDisplay(project) === '—'
    ? ''
    : projectManagerDisplay(project);
}
