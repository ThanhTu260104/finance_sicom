'use client';

import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';

export function QueryState({
  loading,
  error,
  empty,
  emptyMessage = 'Không có dữ liệu.',
  emptyAction,
  onRetry,
  children,
}: {
  loading: boolean;
  error: string | null;
  empty: boolean;
  emptyMessage?: string;
  emptyAction?: ReactNode;
  onRetry?: () => void;
  children: ReactNode;
}) {
  if (loading) {
    return <div className="p-8 text-center text-slate-500">Đang tải...</div>;
  }

  if (error) {
    return (
      <div className="space-y-3 p-8 text-center">
        <p className="text-red-600">{error}</p>
        {onRetry && (
          <Button variant="outline" onClick={onRetry}>
            Thử lại
          </Button>
        )}
      </div>
    );
  }

  if (empty) {
    return (
      <div className="space-y-3 p-8 text-center text-slate-500">
        <p>{emptyMessage}</p>
        {emptyAction}
      </div>
    );
  }

  return <>{children}</>;
}
