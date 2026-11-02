'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { decodeDashboardReturnUrl } from '@/lib/dashboard-filters-url';
import { toast } from 'sonner';
import { dashboardApi } from '@/lib/api';
import type {
  ContractDashboardResponse,
  DashboardOverviewSummary,
} from '@/lib/types';
import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { ContractMonthlyTable } from '@/components/dashboard/contract/contract-monthly-table';
import { ContractDashboardCharts } from '@/components/dashboard/contract/contract-dashboard-charts';
import { CompanyKpiGrid } from '@/components/dashboard/company/kpi-grid';
import { formatDate, formatCurrencyVND } from '@/lib/format';
import { QueryState } from '@/components/shared/query-state';
import { ContractStatusBadge } from '@/components/shared/status-badges';
import { CollapsibleSection } from '@/components/shared/collapsible-section';

function contractSummaryToKpi(
  s: ContractDashboardResponse['summary'],
): DashboardOverviewSummary {
  return {
    contractValue: s.contractValue,
    plannedToDate: s.plannedToDate,
    acceptedToDate: s.acceptedToDate,
    acceptanceGap: s.acceptanceGap,
    plannedInCurrentPeriod: s.plannedInCurrentPeriod,
    acceptedInCurrentPeriod: s.acceptedInCurrentPeriod,
    collectedInCurrentPeriod: s.collectedInCurrentPeriod,
    collectedToDate: s.collectedToDate,
    totalCollected: s.totalCollected,
    acceptanceProgressPercent:
      s.acceptanceProgressPercent ?? s.acceptancePercent,
    collectionProgressPercent:
      s.collectionProgressPercent ?? s.collectionPercent,
    contractCount: 1,
    activeContractCount: 1,
    expiringSoonCount: 0,
    projectCount: 1,
    currentPeriod: s.currentPeriod,
    asOf: s.asOf,
  };
}

export default function ContractDashboardPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const dashboardReturnHref =
    decodeDashboardReturnUrl(searchParams.get('returnTo')) ?? '/';
  const [data, setData] = useState<ContractDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await dashboardApi.contractDashboard(params.id));
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Có lỗi khi tải dashboard hợp đồng';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: 'Dashboard', href: dashboardReturnHref },
          {
            label: data?.contract.project.name ?? 'Dự án',
            href: data
              ? `/projects/${data.contract.project.id}/dashboard`
              : undefined,
          },
          { label: data?.contract.contractNo ?? 'Hợp đồng' },
        ]}
      />

      <QueryState
        loading={loading}
        error={error}
        empty={!data}
        emptyMessage="Chưa có dữ liệu dashboard hợp đồng."
        onRetry={load}
      >
        {data ? (
          <>
            <header className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h1 className="text-2xl font-semibold text-slate-900">
                    {data.contract.contractNo}
                  </h1>
                  <p className="mt-1 text-sm text-slate-700">{data.contract.name}</p>
                  <p className="mt-1 text-sm text-slate-600">
                    {data.contract.project.code} — {data.contract.project.name}
                    {data.contract.project.customer
                      ? ` · ${data.contract.project.customer.name}`
                      : ''}
                  </p>
                </div>
                <ContractStatusBadge status={data.contract.status} />
              </div>
              <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
                <div>
                  <dt className="text-slate-500">Giá trị HĐ</dt>
                  <dd className="font-semibold">
                    {formatCurrencyVND(data.contract.contractValue)}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Bắt đầu</dt>
                  <dd>{formatDate(data.contract.startDate)}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Kết thúc</dt>
                  <dd>{formatDate(data.contract.endDate)}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Còn phải NT / thu</dt>
                  <dd>
                    {formatCurrencyVND(data.summary.remainingAcceptance)} /{' '}
                    {formatCurrencyVND(data.summary.outstandingCollection)}
                  </dd>
                </div>
              </dl>
              <Link
                href={`/contracts/${data.contract.id}`}
                className="mt-3 inline-block text-sm font-medium text-slate-700 underline-offset-2 hover:underline"
              >
                Chi tiết hợp đồng
              </Link>
              <Link
                href={`/contracts/${data.contract.id}/financial-control`}
                className="ml-4 inline-block text-sm font-medium text-slate-700 underline-offset-2 hover:underline"
              >
                Kiểm soát tài chính (nhập liệu)
              </Link>
            </header>

            <CompanyKpiGrid summary={contractSummaryToKpi(data.summary)} />

            <ContractDashboardCharts data={data} variant="full" />

            <CollapsibleSection
              title={data.batchTrend?.length ? 'Bảng chi tiết theo đợt nghiệm thu' : 'Bảng chi tiết theo tháng'}
              description="Dùng để kiểm tra số liệu"
              defaultOpen={false}
            >
              <ContractMonthlyTable
                rows={data.batchTrend?.length ? data.batchTrend : data.monthlyRows}
              />
            </CollapsibleSection>
          </>
        ) : null}
      </QueryState>
    </div>
  );
}
