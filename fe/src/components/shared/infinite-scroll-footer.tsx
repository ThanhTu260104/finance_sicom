'use client';

import { useEffect, useRef } from 'react';

export function InfiniteScrollFooter({
  hasMore,
  loadingMore,
  total,
  onLoadMore,
}: {
  hasMore: boolean;
  loadingMore: boolean;
  total: number;
  onLoadMore: () => void;
}) {
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !loadingMore) {
          onLoadMore();
        }
      },
      { rootMargin: '120px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, onLoadMore]);

  return (
    <div
      ref={sentinelRef}
      className="border-t border-slate-100 px-4 py-3 text-center text-sm text-slate-500"
    >
      {loadingMore ? (
        'Đang tải thêm...'
      ) : hasMore ? (
        'Cuộn để tải thêm'
      ) : (
        <>Đã hiển thị tất cả · Tổng {total} bản ghi</>
      )}
    </div>
  );
}
