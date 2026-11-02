'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { PaginatedMeta, PaginatedResponse } from '@/lib/types';

const DEFAULT_PAGE_SIZE = 20;

export function useInfinitePaginatedList<T>({
  fetchPage,
  resetDeps,
  pageSize = DEFAULT_PAGE_SIZE,
  debounceMs = 250,
}: {
  fetchPage: (page: number, limit: number) => Promise<PaginatedResponse<T>>;
  resetDeps: unknown[];
  pageSize?: number;
  debounceMs?: number;
}) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<PaginatedMeta | null>(null);
  const pageRef = useRef(1);
  const requestIdRef = useRef(0);

  const hasMore =
    meta != null ? pageRef.current < meta.totalPages : false;

  const runFetch = useCallback(
    async (page: number, append: boolean) => {
      const requestId = ++requestIdRef.current;
      if (append) setLoadingMore(true);
      else {
        setLoading(true);
        setError(null);
      }
      try {
        const res = await fetchPage(page, pageSize);
        if (requestId !== requestIdRef.current) return;
        pageRef.current = page;
        setMeta(res.meta);
        setData((prev) => (append ? [...prev, ...res.data] : res.data));
        setError(null);
      } catch (err) {
        if (requestId !== requestIdRef.current) return;
        const message =
          err instanceof Error ? err.message : 'Không tải được dữ liệu';
        setError(message);
        if (!append) setData([]);
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [fetchPage, pageSize],
  );

  const reload = useCallback(() => {
    pageRef.current = 1;
    void runFetch(1, false);
  }, [runFetch]);

  const loadMore = useCallback(() => {
    if (loading || loadingMore || !hasMore) return;
    void runFetch(pageRef.current + 1, true);
  }, [hasMore, loading, loadingMore, runFetch]);

  useEffect(() => {
    pageRef.current = 1;
    setData([]);
    setMeta(null);
    const timer = setTimeout(() => {
      void runFetch(1, false);
    }, debounceMs);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resetDeps drives refetch
  }, [runFetch, debounceMs, ...resetDeps]);

  return {
    data,
    loading,
    loadingMore,
    error,
    total: meta?.total ?? 0,
    hasMore,
    loadMore,
    reload,
    setError,
  };
}
