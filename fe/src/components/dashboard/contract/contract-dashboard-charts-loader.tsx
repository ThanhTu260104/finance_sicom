'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { dashboardApi } from '@/lib/api';
import type { ContractDashboardResponse } from '@/lib/types';
import { ContractDashboardCharts } from '@/components/dashboard/contract/contract-dashboard-charts';

export function ContractDashboardChartsLoader({
  contractId,
  variant = 'embedded',
}: {
  contractId: string;
  variant?: 'full' | 'embedded';
}) {
  const [data, setData] = useState<ContractDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setData(null);
    void dashboardApi
      .contractDashboard(contractId)
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((err) => {
        if (!cancelled) {
          const message =
            err instanceof Error ? err.message : 'Không tải được biểu đồ HĐ';
          setError(message);
          toast.error(message);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [contractId]);

  if (loading) {
    return (
      <p className="text-sm text-slate-500 py-4">Đang tải biểu đồ hợp đồng…</p>
    );
  }
  if (error) {
    return <p className="text-sm text-red-700 py-2">{error}</p>;
  }
  if (!data) return null;

  return <ContractDashboardCharts data={data} variant={variant} />;
}
