'use client';

import Link from 'next/link';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Presentation,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { dashboardApi } from '@/lib/api';
import type {
  DashboardOverviewResponse,
  ProjectDashboardResponse,
} from '@/lib/types';
import {
  overviewQueryKey,
  overviewQueryParams,
  projectDashboardFilterKey,
  projectDashboardQueryParams,
} from '@/lib/dashboard-query-slices';
import { applyKpiPeriodToSummary } from '@/lib/dashboard-kpi-for-period';
import {
  parsePresentationUrl,
  presentationUrlToSearchParams,
  type PresentationStep,
} from '@/lib/presentation-url';
import { formatPeriod } from '@/lib/format';
import { CompanyKpiGrid } from '@/components/dashboard/company/kpi-grid';
import { CompanyKpiMonthBreakdown } from '@/components/dashboard/company/company-kpi-month-breakdown';
import { FinancialTimeSeriesChart } from '@/components/dashboard/financial-chart/time-series-chart';
import { ProjectSCurveChart } from '@/components/dashboard/project-s-curve-chart';
import { companyOverviewChartContext } from '@/components/dashboard/financial-chart/chart-fullscreen-context';
import { ProjectSearchSelect } from '@/components/dashboard/company/project-search-select';
import { ProjectContractList } from '@/components/dashboard/company/project-contract-list';
import { ProjectContractDetailPanel } from '@/components/dashboard/company/project-contract-detail-panel';
import { Button } from '@/components/ui/button';
import {
  DashboardFilterField,
  DashboardMonthInput,
} from '@/components/dashboard/company/dashboard-panel-header';

const STEP_LABELS: Record<PresentationStep, string> = {
  1: 'Toàn công ty',
  2: 'Chọn dự án',
  3: 'Dashboard dự án',
  4: 'Hợp đồng & NT',
};

/** Nội dung slide sáng — tránh chữ xám/biểu đồ dashboard bị chìm trên nền đen. */
const PRESENTATION_SLIDE =
  'space-y-6 rounded-2xl border border-slate-700/80 bg-white p-5 text-slate-900 shadow-xl md:p-8 [&_.text-slate-900]:text-slate-900 [&_.text-slate-800]:text-slate-800 [&_.text-slate-700]:text-slate-700 [&_.text-slate-600]:text-slate-600 [&_.text-slate-500]:text-slate-600';

export function PresentationView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlState = useMemo(
    () => parsePresentationUrl(searchParams),
    [searchParams],
  );
  const { step, projectId, contractId } = urlState;

  const sessionPeriod =
    urlState.query.kpiPeriod ??
    urlState.query.projectPeriod ??
    '';

  const replaceState = useCallback(
    (patch: Partial<typeof urlState> & { step?: PresentationStep }) => {
      const next = {
        ...urlState,
        ...patch,
        query: patch.query ?? urlState.query,
      };
      const p = presentationUrlToSearchParams(next);
      router.replace(`/presentation?${p.toString()}`, { scroll: false });
    },
    [router, urlState],
  );

  const setStep = (nextStep: PresentationStep) => {
    if (nextStep === 3 && !projectId) return;
    if (nextStep === 4 && !projectId) return;
    replaceState({ step: nextStep });
  };

  const setPeriod = (period: string) => {
    if (!period.trim()) return;
    replaceState({
      query: {
        ...urlState.query,
        kpiPeriod: period,
        projectPeriod: period,
      },
    });
  };

  const overviewQuery = useMemo(
    () => overviewQueryParams(urlState.query),
    [urlState.query],
  );
  const overviewKey = useMemo(
    () => overviewQueryKey(urlState.query),
    [urlState.query],
  );

  const [overview, setOverview] = useState<DashboardOverviewResponse | null>(
    null,
  );
  const [overviewLoading, setOverviewLoading] = useState(true);

  const [projectDetail, setProjectDetail] =
    useState<ProjectDashboardResponse | null>(null);
  const [projectLoading, setProjectLoading] = useState(false);
  const projectRequestRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    setOverviewLoading(true);
    void dashboardApi
      .overview({
        ...overviewQuery,
        kpiPeriod: sessionPeriod || undefined,
      })
      .then((data) => {
        if (!cancelled) setOverview(data);
      })
      .catch((err) => {
        if (!cancelled) {
          toast.error(
            err instanceof Error ? err.message : 'Không tải được tổng quan',
          );
        }
      })
      .finally(() => {
        if (!cancelled) setOverviewLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [overviewKey, sessionPeriod, overviewQuery]);

  const projectFilterKey = useMemo(
    () => projectDashboardFilterKey(urlState.query),
    [urlState.query],
  );

  const fetchProject = useCallback(async () => {
    if (!projectId) {
      setProjectDetail(null);
      return;
    }
    const requestId = ++projectRequestRef.current;
    setProjectLoading(true);
    try {
      const data = await dashboardApi.projectDashboard(
        projectId,
        projectDashboardQueryParams(urlState.query, sessionPeriod),
      );
      if (requestId !== projectRequestRef.current) return;
      setProjectDetail(data);
    } catch (err) {
      if (requestId !== projectRequestRef.current) return;
      toast.error(
        err instanceof Error ? err.message : 'Không tải được dự án',
      );
    } finally {
      if (requestId === projectRequestRef.current) {
        setProjectLoading(false);
      }
    }
  }, [projectId, projectFilterKey, sessionPeriod, urlState.query]);

  useEffect(() => {
    if (step >= 3 && projectId) {
      void fetchProject();
    }
  }, [step, projectId, fetchProject]);

  useEffect(() => {
    if (step !== 4 || !projectDetail?.contracts.length) return;
    if (contractId) {
      const exists = projectDetail.contracts.some(
        (c) => c.contractId === contractId,
      );
      if (exists) return;
    }
    const first = projectDetail.contracts[0]?.contractId;
    if (first) {
      replaceState({ contractId: first });
    }
  }, [step, projectDetail, contractId, replaceState]);

  const projectKpi = useMemo(() => {
    if (!projectDetail || !sessionPeriod) return null;
    return applyKpiPeriodToSummary(
      projectDetail.summary,
      projectDetail.cumulativeTrend,
      sessionPeriod,
    );
  }, [projectDetail, sessionPeriod]);

  const sortedContracts = useMemo(() => {
    if (!projectDetail) return [];
    return [...projectDetail.contracts].sort((a, b) =>
      a.contractNo.localeCompare(b.contractNo),
    );
  }, [projectDetail]);

  const selectedContract = useMemo(() => {
    if (!projectDetail || !contractId) return null;
    return (
      projectDetail.contracts.find((c) => c.contractId === contractId) ?? null
    );
  }, [projectDetail, contractId]);

  const contractIndex = useMemo(() => {
    if (!contractId) return -1;
    return sortedContracts.findIndex((c) => c.contractId === contractId);
  }, [sortedContracts, contractId]);

  const goPrevContract = () => {
    if (contractIndex <= 0) return;
    replaceState({ contractId: sortedContracts[contractIndex - 1].contractId });
  };

  const goNextContract = () => {
    if (contractIndex < 0 || contractIndex >= sortedContracts.length - 1) return;
    replaceState({ contractId: sortedContracts[contractIndex + 1].contractId });
  };

  const canGoBack = step > 1;
  const canGoForward =
    step < 4 &&
    (step !== 2 || !!projectId) &&
    (step !== 3 || !!projectId);

  const goBack = () => {
    if (step === 4) setStep(3);
    else if (step === 3) setStep(2);
    else if (step === 2) setStep(1);
  };

  const goForward = () => {
    if (step === 1) setStep(2);
    else if (step === 2 && projectId) setStep(3);
    else if (step === 3 && projectId) setStep(4);
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (step === 4 && contractIndex > 0) goPrevContract();
        else if (canGoBack) goBack();
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (step === 4 && contractIndex >= 0 && contractIndex < sortedContracts.length - 1) {
          goNextContract();
        } else if (canGoForward) goForward();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  const kpiPeriodKey =
    sessionPeriod ||
    overview?.summary?.kpiPeriod ||
    overview?.summary?.currentPeriod ||
    '';

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-20 border-b border-slate-800 bg-slate-950/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Presentation className="h-5 w-5 text-sky-400" aria-hidden />
            <div>
              <p className="text-sm font-semibold">Trình chiếu</p>
              <p className="text-xs text-slate-400">
                Tháng {formatPeriod(sessionPeriod)} · không hiển thị chi phí
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-4">
            <DashboardFilterField
              id="presentation-month"
              label="Tháng xuyên suốt"
              className="text-slate-300 [&_label]:text-slate-400"
            >
              <DashboardMonthInput
                id="presentation-month"
                value={sessionPeriod}
                onChange={setPeriod}
                className="border-slate-700 bg-slate-900 text-slate-100"
              />
            </DashboardFilterField>
            <Button asChild variant="outline" size="sm" className="border-slate-600 bg-transparent text-slate-200 hover:bg-slate-800">
              <Link href="/">
                <X className="mr-1 h-4 w-4" />
                Thoát
              </Link>
            </Button>
          </div>
        </div>

        <nav
          className="mx-auto mt-3 flex max-w-7xl flex-wrap gap-2"
          aria-label="Các bước trình chiếu"
        >
          {([1, 2, 3, 4] as PresentationStep[]).map((s) => {
            const disabled =
              (s === 3 && !projectId) || (s === 4 && !projectId);
            return (
              <button
                key={s}
                type="button"
                disabled={disabled}
                onClick={() => !disabled && setStep(s)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  step === s
                    ? 'bg-sky-600 text-white'
                    : disabled
                      ? 'cursor-not-allowed text-slate-600'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {s}. {STEP_LABELS[s]}
              </button>
            );
          })}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
        {step === 1 ? (
          <section className="space-y-6">
            <h2 className="font-serif text-2xl font-semibold text-white">
              Kế hoạch & nghiệm thu — toàn công ty
            </h2>
            {overviewLoading && !overview ? (
              <p className="flex items-center gap-2 text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                Đang tải…
              </p>
            ) : null}
            {overview ? (
              <div className={PRESENTATION_SLIDE}>
                <CompanyKpiGrid
                  summary={overview.summary}
                  kpiPeriod={kpiPeriodKey}
                  includeOperatingCost={false}
                />
                <FinancialTimeSeriesChart
                  title="S-Curve toàn công ty"
                  data={overview.cumulativeTrend}
                  currentPeriod={overview.summary.currentPeriod}
                  contractValueForProgress={overview.summary.contractValue}
                  fullscreenContext={companyOverviewChartContext(
                    overview.summary,
                  )}
                  showSeriesToggle
                  showChartPeriodFilter
                  allowModeSwitch
                />
                {overview.kpiMonthBreakdown ? (
                  <CompanyKpiMonthBreakdown
                    breakdown={overview.kpiMonthBreakdown}
                    kpiPeriod={kpiPeriodKey}
                    onKpiPeriodChange={setPeriod}
                    metricsStale={overviewLoading}
                    hidePeriodPicker
                    embedded
                    periodPickerId="presentation-kpi-breakdown-period"
                  />
                ) : null}
              </div>
            ) : null}
          </section>
        ) : null}

        {step === 2 ? (
          <section className="space-y-6">
            <h2 className="font-serif text-2xl font-semibold text-white">
              Chọn dự án
            </h2>
            {overviewLoading && !overview ? (
              <p className="text-slate-400">Đang tải danh sách dự án…</p>
            ) : overview?.byProject.length ? (
              <div className={PRESENTATION_SLIDE}>
                <ProjectSearchSelect
                  projects={overview.byProject}
                  selectedId={projectId ?? null}
                  onSelect={(id) => {
                    replaceState({
                      projectId: id ?? undefined,
                      contractId: undefined,
                    });
                  }}
                />
                {projectId ? (
                  <p className="mt-4 text-sm font-medium text-sky-800">
                    Đã chọn dự án — bấm Tiếp để xem dashboard dự án.
                  </p>
                ) : (
                  <p className="mt-4 text-sm text-slate-600">
                    Chọn một dự án trong danh sách.
                  </p>
                )}
              </div>
            ) : (
              <p className="text-slate-500">Không có dự án phù hợp bộ lọc.</p>
            )}
          </section>
        ) : null}

        {step === 3 && projectId ? (
          <section className="relative space-y-6">
            {projectLoading ? (
              <div className="flex items-center gap-2 text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                Đang tải dashboard dự án…
              </div>
            ) : null}
            {projectDetail ? (
              <>
                <div>
                  <h2 className="font-serif text-2xl font-semibold text-white">
                    {projectDetail.project.name}
                  </h2>
                  <p className="text-sm text-slate-400">
                    Mã {projectDetail.project.code}
                    {projectDetail.project.customer
                      ? ` · ${projectDetail.project.customer.name}`
                      : ''}
                  </p>
                </div>
                <div className={PRESENTATION_SLIDE}>
                  {projectKpi ? (
                    <CompanyKpiGrid
                      summary={projectKpi}
                      kpiPeriod={sessionPeriod}
                      includeOperatingCost={false}
                    />
                  ) : null}
                  <ProjectSCurveChart detail={projectDetail} />
                  <p className="text-sm text-slate-600">
                    {projectDetail.contracts.length} hợp đồng — bấm Tiếp để xem
                    từng HĐ và tiến độ nghiệm thu.
                  </p>
                </div>
              </>
            ) : null}
          </section>
        ) : null}

        {step === 4 && projectId ? (
          <section className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="font-serif text-2xl font-semibold text-white">
                  Hợp đồng & nghiệm thu
                </h2>
                {projectDetail ? (
                  <p className="text-sm text-slate-400">
                    {projectDetail.project.name} ·{' '}
                    {sortedContracts.length} HĐ
                  </p>
                ) : null}
              </div>
              {sortedContracts.length > 1 ? (
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-slate-600 bg-transparent text-slate-200"
                    disabled={contractIndex <= 0}
                    onClick={goPrevContract}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    HĐ trước
                  </Button>
                  <span className="text-xs text-slate-400">
                    {contractIndex >= 0 ? contractIndex + 1 : 0} /{' '}
                    {sortedContracts.length}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-slate-600 bg-transparent text-slate-200"
                    disabled={
                      contractIndex < 0 ||
                      contractIndex >= sortedContracts.length - 1
                    }
                    onClick={goNextContract}
                  >
                    HĐ sau
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              ) : null}
            </div>

            {projectLoading && !projectDetail ? (
              <p className="text-slate-400">Đang tải hợp đồng…</p>
            ) : projectDetail ? (
              <div className={PRESENTATION_SLIDE}>
                <ProjectContractList
                  contracts={projectDetail.contracts}
                  selectedContractId={contractId ?? null}
                  onSelect={(id) => replaceState({ contractId: id })}
                />
                {selectedContract ? (
                  <ProjectContractDetailPanel contract={selectedContract} />
                ) : (
                  <p className="text-center text-sm text-slate-600">
                    Chọn hợp đồng để xem biểu đồ nghiệm thu.
                  </p>
                )}
              </div>
            ) : null}
          </section>
        ) : null}
      </main>

      <footer className="sticky bottom-0 border-t border-slate-800 bg-slate-950/95 px-4 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="min-w-[8rem] border-slate-600 bg-transparent text-slate-200"
            disabled={!canGoBack}
            onClick={goBack}
          >
            <ChevronLeft className="mr-1 h-5 w-5" />
            Lùi
          </Button>
          <p className="hidden text-center text-xs text-slate-500 sm:block">
            Phím ← → để lùi / tiếp (hoặc chuyển HĐ ở bước 4)
          </p>
          <Button
            type="button"
            size="lg"
            className="min-w-[8rem] bg-sky-600 hover:bg-sky-500"
            disabled={!canGoForward}
            onClick={goForward}
          >
            Tiếp
            <ChevronRight className="ml-1 h-5 w-5" />
          </Button>
        </div>
      </footer>
    </div>
  );
}
