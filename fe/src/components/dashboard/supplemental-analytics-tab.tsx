'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { dashboardApi } from '@/lib/api';
import type { DashboardOverviewLegacy } from '@/lib/types';
import { CompanyAnalyticsPanel } from '@/components/dashboard/company-analytics-panel';
import { ProjectAnalyticsPanel } from '@/components/dashboard/project-analytics-panel';
import { QueryState } from '@/components/shared/query-state';

/** Tab phân tích bổ sung — dùng overview-legacy cho chart/panel cũ. */
export function SupplementalAnalyticsTab() {
  const [data, setData] = useState<DashboardOverviewLegacy | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const overview = await dashboardApi.overviewLegacy();
      setData({
        ...overview,
        projectScopes: overview.projectScopes ?? [],
        byContract: overview.byContract ?? [],
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Không tải được phân tích bổ sung';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  return (
    <QueryState
      loading={loading}
      error={error}
      empty={!data}
      emptyMessage="Chưa có dữ liệu phân tích bổ sung."
      onRetry={load}
    >
      {data ? (
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Các biểu đồ và panel trước đây. Dashboard chính nằm ở tab Tổng quan.
            Có thể gỡ bớt sau khi migration hoàn tất:{' '}
            <span className="font-medium">company-analytics-panel</span>,{' '}
            <span className="font-medium">project-analytics-panel</span> (một phần
            trùng S-Curve mới).
          </p>
          <CompanyAnalyticsPanel data={data} />
          <ProjectAnalyticsPanel data={data} />
        </div>
      ) : null}
    </QueryState>
  );
}
