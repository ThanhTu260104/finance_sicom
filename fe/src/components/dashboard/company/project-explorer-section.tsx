'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { dashboardApi } from '@/lib/api';
import type {
  DashboardByProjectRow,
  DashboardQueryParams,
  ProjectDashboardResponse,
} from '@/lib/types';
import { compareDecimalStrings } from '@/lib/format';
import {
  buildCompanyDashboardReturnUrl,
  dashboardQueryToSearchParams,
  parseDashboardQuery,
} from '@/lib/dashboard-filters-url';
import { applyKpiPeriodToSummary } from '@/lib/dashboard-kpi-for-period';
import {
  projectDashboardFilterKey,
  projectDashboardQueryParams,
} from '@/lib/dashboard-query-slices';
import { ProjectSearchSelect } from '@/components/dashboard/company/project-search-select';
import { CompanyKpiGrid } from '@/components/dashboard/company/kpi-grid';
import { ProjectSCurveChart } from '@/components/dashboard/project-s-curve-chart';
import { ProjectContractList } from '@/components/dashboard/company/project-contract-list';
import { ProjectContractDetailPanel } from '@/components/dashboard/company/project-contract-detail-panel';
import { Button } from '@/components/ui/button';

function syncProjectPeriodInUrl(
  appliedQuery: DashboardQueryParams,
  projectPeriod: string,
) {
  if (typeof window === 'undefined') return;
  const next = dashboardQueryToSearchParams({
    ...appliedQuery,
    projectPeriod,
  });
  const url = `/?${next.toString()}`;
  window.history.replaceState(window.history.state, '', url);
}

export function ProjectExplorerSection({
  projects,
  appliedQuery,
}: {
  projects: DashboardByProjectRow[];
  appliedQuery: DashboardQueryParams;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return parseDashboardQuery(new URLSearchParams(window.location.search))
      .explorerProjectId ?? null;
  });
  const [selectedContractId, setSelectedContractId] = useState<string | null>(
    () => {
      if (typeof window === 'undefined') return null;
      return (
        parseDashboardQuery(new URLSearchParams(window.location.search))
          .explorerContractId ?? null
      );
    },
  );
  const [projectPeriod, setProjectPeriod] = useState(
    () => appliedQuery.projectPeriod ?? '',
  );
  const [detail, setDetail] = useState<ProjectDashboardResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const detailRequestRef = useRef(0);

  const sorted = useMemo(
    () =>
      [...projects].sort((a, b) =>
        compareDecimalStrings(b.acceptanceGap, a.acceptanceGap),
      ),
    [projects],
  );

  const projectFiltersKey = useMemo(
    () => projectDashboardFilterKey(appliedQuery),
    [appliedQuery],
  );

  const fetchProjectDetail = useCallback(
    async (projectId: string) => {
      const requestId = ++detailRequestRef.current;
      setDetailLoading(true);
      try {
        const data = await dashboardApi.projectDashboard(
          projectId,
          projectDashboardQueryParams(appliedQuery),
        );
        if (requestId !== detailRequestRef.current) return;
        setDetail(data);
        setProjectPeriod((prev) => {
          if (prev) return prev;
          return (
            data.summary.kpiPeriod ??
            data.summary.currentPeriod ??
            ''
          );
        });
      } catch (err) {
        if (requestId !== detailRequestRef.current) return;
        toast.error(
          err instanceof Error ? err.message : 'Không tải được dữ liệu dự án',
        );
      } finally {
        if (requestId === detailRequestRef.current) {
          setDetailLoading(false);
        }
      }
    },
    [appliedQuery],
  );

  const syncExplorerSelectionInUrl = useCallback(
    (projectId: string | null, contractId: string | null) => {
      if (typeof window === 'undefined') return;
      const next = dashboardQueryToSearchParams({
        ...appliedQuery,
        projectPeriod: projectPeriod || appliedQuery.projectPeriod,
        explorerProjectId: projectId ?? undefined,
        explorerContractId: contractId ?? undefined,
      });
      window.history.replaceState(
        window.history.state,
        '',
        `/?${next.toString()}`,
      );
    },
    [appliedQuery, projectPeriod],
  );

  const selectProject = (projectId: string | null) => {
    if (!projectId || selectedId === projectId) {
      setSelectedId(null);
      setDetail(null);
      setSelectedContractId(null);
      syncExplorerSelectionInUrl(null, null);
      return;
    }
    setSelectedId(projectId);
    setSelectedContractId(null);
    syncExplorerSelectionInUrl(projectId, null);
  };

  useEffect(() => {
    if (selectedId) {
      void fetchProjectDetail(selectedId);
    }
  }, [selectedId, projectFiltersKey, fetchProjectDetail]);

  useEffect(() => {
    if (
      appliedQuery.projectPeriod &&
      appliedQuery.projectPeriod !== projectPeriod
    ) {
      setProjectPeriod(appliedQuery.projectPeriod);
    }
  }, [appliedQuery.projectPeriod, projectPeriod]);

  const handleProjectPeriodChange = (period: string) => {
    if (!period) return;
    setProjectPeriod(period);
    syncProjectPeriodInUrl(appliedQuery, period);
  };

  const selectedContract = useMemo(() => {
    if (!detail || !selectedContractId) return null;
    return (
      detail.contracts.find((c) => c.contractId === selectedContractId) ?? null
    );
  }, [detail, selectedContractId]);

  const toggleContract = (contractId: string) => {
    setSelectedContractId((prev) => {
      const next = prev === contractId ? null : contractId;
      syncExplorerSelectionInUrl(selectedId, next);
      return next;
    });
  };

  const projectPeriodKey =
    projectPeriod ||
    detail?.summary?.kpiPeriod ||
    detail?.summary?.currentPeriod ||
    '';

  const kpiSummary = useMemo(() => {
    if (!detail || !projectPeriodKey) return null;
    return applyKpiPeriodToSummary(
      detail.summary,
      detail.cumulativeTrend,
      projectPeriodKey,
    );
  }, [detail, projectPeriodKey]);

  const dashboardReturnUrl = useMemo(
    () =>
      buildCompanyDashboardReturnUrl({
        ...appliedQuery,
        explorerProjectId: selectedId ?? undefined,
        explorerContractId: selectedContractId ?? undefined,
        projectPeriod: projectPeriod || appliedQuery.projectPeriod,
      }),
    [appliedQuery, selectedId, selectedContractId, projectPeriod],
  );

  if (projects.length === 0) {
    return (
      <p className="text-sm text-slate-500">Chưa có dự án phù hợp bộ lọc.</p>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Chi tiết theo dự án
      </h3>

      <ProjectSearchSelect
        projects={sorted}
        selectedId={selectedId}
        onSelect={selectProject}
      />

      {selectedId ? (
        <div className="relative space-y-6 rounded-xl border border-slate-200 bg-slate-50/50 p-4 md:p-6">
          {detailLoading ? (
            <div
              className="pointer-events-none absolute inset-0 z-10 flex items-start justify-center rounded-xl bg-white/60 pt-16"
              aria-hidden={!detailLoading}
            >
              <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 shadow-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                Đang cập nhật số liệu…
              </div>
            </div>
          ) : null}

          {!detail && detailLoading ? (
            <p className="text-sm text-slate-600">Đang tải chi tiết dự án…</p>
          ) : null}

          {detail ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h4 className="text-lg font-semibold text-slate-900">
                    {detail.project.name}
                  </h4>
                  <p className="text-sm text-slate-600">
                    Mã {detail.project.code}
                    {detail.project.customer
                      ? ` · ${detail.project.customer.name}`
                      : ''}
                  </p>
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link href={`/projects/${detail.project.id}/dashboard`}>
                    Mở dashboard dự án
                  </Link>
                </Button>
              </div>

              {kpiSummary ? (
                <CompanyKpiGrid
                  summary={kpiSummary}
                  kpiPeriod={projectPeriodKey}
                  onKpiPeriodChange={handleProjectPeriodChange}
                  showPeriodPicker
                  periodPickerLabel="Tháng / năm thống kê"
                  periodPickerId="project-explorer-kpi-period"
                />
              ) : null}

              <section className="space-y-2">
                <h5 className="text-sm font-semibold text-slate-800">
                  S-Curve dự án
                </h5>
                <ProjectSCurveChart detail={detail} />
              </section>

              <section className="space-y-3">
                <div>
                  <h5 className="text-sm font-semibold text-slate-800">
                    Hợp đồng ({detail.contracts.length})
                  </h5>
                  <p className="text-xs text-slate-500">
                    Chỉ hiển thị mã và tên — bấm một dòng để xem chi tiết đợt
                    nghiệm thu và tiến độ bên dưới.
                  </p>
                </div>
                <ProjectContractList
                  contracts={detail.contracts}
                  selectedContractId={selectedContractId}
                  onSelect={toggleContract}
                />
                {selectedContract ? (
                  <ProjectContractDetailPanel
                    contract={selectedContract}
                    dashboardReturnUrl={dashboardReturnUrl}
                  />
                ) : selectedContractId && detailLoading ? (
                  <p className="py-2 text-center text-xs text-slate-500">
                    Đang tải chi tiết hợp đồng…
                  </p>
                ) : (
                  <p className="py-2 text-center text-xs text-slate-500">
                    Chọn hợp đồng trong danh sách để xem chi tiết.
                  </p>
                )}
              </section>
            </>
          ) : null}
        </div>
      ) : (
        <p className="py-4 text-center text-xs text-slate-400">
          Chọn một dự án ở trên để xem biểu đồ và hợp đồng.
        </p>
      )}
    </div>
  );
}
