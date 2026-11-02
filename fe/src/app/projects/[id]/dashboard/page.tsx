'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { dashboardApi } from '@/lib/api';
import type {
  DashboardQueryParams,
  ProjectDashboardResponse,
} from '@/lib/types';
import {
  dashboardQueryToSearchParams,
  parseDashboardQuery,
} from '@/lib/dashboard-filters-url';
import { applyKpiPeriodToSummary } from '@/lib/dashboard-kpi-for-period';
import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { CompanyKpiGrid } from '@/components/dashboard/company/kpi-grid';
import { DashboardFilters } from '@/components/dashboard/company/dashboard-filters';
import { ProjectSCurveChart } from '@/components/dashboard/project-s-curve-chart';
import { ProjectContractList } from '@/components/dashboard/company/project-contract-list';
import { ProjectContractDetailPanel } from '@/components/dashboard/company/project-contract-detail-panel';
import { formatCurrencyVND, formatDate } from '@/lib/format';
import { QueryState } from '@/components/shared/query-state';
import { ContractStatusBadge } from '@/components/shared/status-badges';
import { CollapsibleSection } from '@/components/shared/collapsible-section';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export default function ProjectDashboardPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const appliedQuery = useMemo(
    () => parseDashboardQuery(searchParams),
    [searchParams],
  );
  const [draft, setDraft] = useState<DashboardQueryParams>(() => appliedQuery);
  const [data, setData] = useState<ProjectDashboardResponse | null>(null);
  const [projectPeriod, setProjectPeriod] = useState(
    () => appliedQuery.projectPeriod ?? appliedQuery.kpiPeriod ?? '',
  );
  const [selectedContractId, setSelectedContractId] = useState<string | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await dashboardApi.projectDashboard(params.id, appliedQuery));
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Có lỗi khi tải dashboard dự án';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [params.id, appliedQuery]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const applyFilters = () => {
    const p = dashboardQueryToSearchParams({ ...draft, projectId: params.id });
    router.replace(`/projects/${params.id}/dashboard?${p.toString()}`, {
      scroll: false,
    });
  };

  const handleKpiPeriodChange = (period: string) => {
    if (!period) return;
    setProjectPeriod(period);
    const p = dashboardQueryToSearchParams({
      ...appliedQuery,
      projectPeriod: period,
    });
    router.replace(`/projects/${params.id}/dashboard?${p.toString()}`, {
      scroll: false,
    });
  };

  const projectPeriodKey =
    projectPeriod ||
    data?.summary.kpiPeriod ||
    data?.summary.currentPeriod ||
    '';

  const kpiSummary = useMemo(() => {
    if (!data || !projectPeriodKey) return null;
    return applyKpiPeriodToSummary(
      data.summary,
      data.cumulativeTrend,
      projectPeriodKey,
    );
  }, [data, projectPeriodKey]);

  useEffect(() => {
    if (appliedQuery.projectPeriod) {
      setProjectPeriod(appliedQuery.projectPeriod);
    }
  }, [appliedQuery.projectPeriod]);

  const selectedContract = useMemo(() => {
    if (!data || !selectedContractId) return null;
    return (
      data.contracts.find((c) => c.contractId === selectedContractId) ?? null
    );
  }, [data, selectedContractId]);

  useEffect(() => {
    setSelectedContractId(null);
  }, [data?.project.id]);

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: 'Dashboard', href: '/' },
          { label: 'Dự án', href: '/projects' },
          { label: data?.project.name ?? '…' },
        ]}
      />

      <QueryState
        loading={loading}
        error={error}
        empty={!data}
        emptyMessage="Chưa có dữ liệu dashboard dự án."
        onRetry={load}
      >
        {data ? (
          <>
            <header className="space-y-1">
              <h1 className="text-2xl font-semibold text-slate-900">
                {data.project.name}
              </h1>
              <p className="text-sm text-slate-600">
                Mã {data.project.code}
                {data.project.customer
                  ? ` · ${data.project.customer.name}`
                  : ''}
              </p>
              <Link
                href={`/projects/${data.project.id}`}
                className="text-sm font-medium text-slate-700 underline-offset-2 hover:underline"
              >
                Hồ sơ dự án
              </Link>
            </header>

            <DashboardFilters
              value={draft}
              onChange={setDraft}
              onApply={applyFilters}
            />

            {kpiSummary ? (
              <CompanyKpiGrid
                summary={kpiSummary}
                kpiPeriod={projectPeriodKey}
                onKpiPeriodChange={handleKpiPeriodChange}
                showPeriodPicker
                periodPickerLabel="Tháng / năm thống kê"
                periodPickerId="project-page-kpi-period"
              />
            ) : null}

            <section className="space-y-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">
                S-Curve dự án
              </h2>
              <ProjectSCurveChart detail={data} />
            </section>

            <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">
                  Hợp đồng ({data.contracts.length})
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Mã và tên — bấm để xem đợt nghiệm thu và tiến độ bên dưới.
                </p>
              </div>
              <ProjectContractList
                contracts={data.contracts}
                selectedContractId={selectedContractId}
                onSelect={(id) =>
                  setSelectedContractId((prev) => (prev === id ? null : id))
                }
              />
              {selectedContract ? (
                <ProjectContractDetailPanel contract={selectedContract} />
              ) : null}
            </section>

            <CollapsibleSection
              title="Xem dữ liệu chi tiết hợp đồng"
              defaultOpen={false}
            >
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Hợp đồng</TableHead>
                      <TableHead className="text-right">Giá trị</TableHead>
                      <TableHead>Bắt đầu</TableHead>
                      <TableHead>Kết thúc</TableHead>
                      <TableHead className="text-right">Chênh lệch NT</TableHead>
                      <TableHead className="text-right">Còn phải thu</TableHead>
                      <TableHead className="text-right">% tiến độ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.contracts.map((c) => (
                      <TableRow key={c.contractId}>
                        <TableCell>
                          <Link
                            href={`/contracts/${c.contractId}/dashboard`}
                            className="font-medium hover:underline"
                          >
                            {c.contractNo}
                          </Link>
                          <p className="text-xs text-slate-600">{c.name}</p>
                          <ContractStatusBadge status={c.status} />
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-sm">
                          {formatCurrencyVND(c.contractValue)}
                        </TableCell>
                        <TableCell className="text-sm">
                          {formatDate(c.startDate)}
                        </TableCell>
                        <TableCell className="text-sm">
                          {formatDate(c.endDate)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-sm">
                          {formatCurrencyVND(c.acceptanceGap)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-sm">
                          {formatCurrencyVND(c.outstandingCollection)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-sm">
                          {c.timeProgressPercent ?? '—'}%
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CollapsibleSection>
          </>
        ) : null}
      </QueryState>
    </div>
  );
}
