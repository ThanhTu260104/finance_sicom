import type { PaginatedResponse } from '@/lib/types';

/** Gom mọi trang API phân trang (dùng cho xuất Excel đầy đủ). */
export async function fetchAllPaginated<T>(
  fetchPage: (page: number, limit: number) => Promise<PaginatedResponse<T>>,
  pageSize = 100,
): Promise<T[]> {
  const all: T[] = [];
  let page = 1;
  let totalPages = 1;
  while (page <= totalPages) {
    const res = await fetchPage(page, pageSize);
    all.push(...res.data);
    totalPages = res.meta.totalPages;
    page += 1;
  }
  return all;
}
