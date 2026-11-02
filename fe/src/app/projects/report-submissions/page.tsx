'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, Clock, FileText, Search, ChevronRight } from 'lucide-react';
import { ReportSubmissionFileDownload } from '@/components/projects/report-submission-file-download';
import { formatCurrencyVND, formatPeriod } from '@/lib/format';
import { projectReportSubmissionsApi } from '@/lib/api';
import type { ProjectReportSubmissionPeriodSummary } from '@/lib/types';
import { currentCalendarPeriod } from '@/lib/period';
import { MonthlyWorkspaceShell } from '@/components/monthly-workspace/monthly-workspace-shell';
import { ProjectReportSubmissionForm } from '@/components/projects/project-report-submission-form';
import { ReportSubmissionDetailDialog } from '@/components/projects/report-submission-detail-dialog';
import { QueryState } from '@/components/shared/query-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

function StatTile({
  label,
  value,
  tone,
  icon: Icon,
}: {
  label: string;
  value: number;
  tone: 'slate' | 'emerald' | 'amber';
  icon: typeof FileText;
}) {
  const tones = {
    slate: 'border-slate-200 bg-white text-slate-900',
    emerald: 'border-emerald-200 bg-emerald-50/80 text-emerald-950',
    amber: 'border-amber-200 bg-amber-50/80 text-amber-950',
  };
  return (
    <div
      className={cn(
        'rounded-xl border px-4 py-3 shadow-sm',
        tones[tone],
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide opacity-80">
          {label}
        </p>
        <Icon className="h-4 w-4 opacity-60" />
      </div>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

export default function ProjectReportSubmissionsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const submissionIdParam = searchParams.get('submissionId');

  const [period, setPeriod] = useState(currentCalendarPeriod);
  const [summary, setSummary] =
    useState<ProjectReportSubmissionPeriodSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [listSearch, setListSearch] = useState('');
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [formProjectId, setFormProjectId] = useState('');

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSummary(await projectReportSubmissionsApi.periodSummary(period));
    } catch (err) {
      setSummary(null);
      setError(
        err instanceof Error ? err.message : 'Không tải được tổng hợp tháng',
      );
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (submissionIdParam) {
      setDetailId(submissionIdParam);
      setDetailOpen(true);
    }
  }, [submissionIdParam]);

  const needle = listSearch.trim().toLowerCase();
  const matchText = (code: string, name: string, extra?: string | null) => {
    if (!needle) return true;
    return (
      code.toLowerCase().includes(needle) ||
      name.toLowerCase().includes(needle) ||
      (extra?.toLowerCase().includes(needle) ?? false)
    );
  };

  const pendingFiltered = useMemo(
    () =>
      summary?.pending.filter((p) =>
        matchText(p.projectCode, p.projectName, p.customerName),
      ) ?? [],
    [summary?.pending, needle],
  );

  const submittedFiltered = useMemo(
    () =>
      summary?.submitted.filter((p) =>
        matchText(p.projectCode, p.projectName, p.title),
      ) ?? [],
    [summary?.submitted, needle],
  );

  const openDetail = (id: string) => {
    setDetailId(id);
    setDetailOpen(true);
    router.replace(`/projects/report-submissions?submissionId=${id}`, {
      scroll: false,
    });
  };

  const closeDetail = () => {
    setDetailOpen(false);
    setDetailId(null);
    router.replace('/projects/report-submissions', { scroll: false });
  };

  return (
    <>
      <MonthlyWorkspaceShell
        title={`Nộp báo cáo · ${formatPeriod(period)}`}
        subtitle="Theo dõi theo tháng: dự án đã nộp / chưa nộp, nộp báo cáo KH nghiệm thu và xem chi tiết ngay tại đây — không cần mở trang riêng."
        period={period}
        onPeriodChange={setPeriod}
        periodLabel="Tháng làm việc"
        headerExtra={
          <Button asChild variant="secondary" size="sm" className="bg-white/95">
            <Link href="/forms/nop-bao-cao" target="_blank" rel="noreferrer">
              Form công khai
            </Link>
          </Button>
        }
      >
        <QueryState loading={loading} error={error} empty={false} onRetry={() => void reload()}>
          {summary ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <StatTile
                  label="Tổng dự án active"
                  value={summary.totalProjects}
                  tone="slate"
                  icon={FileText}
                />
                <StatTile
                  label="Đã nộp tháng này"
                  value={summary.submittedCount}
                  tone="emerald"
                  icon={CheckCircle2}
                />
                <StatTile
                  label="Chưa nộp"
                  value={summary.pendingCount}
                  tone="amber"
                  icon={Clock}
                />
              </div>

              <Card
                id="report-submit-form-anchor"
                className="scroll-mt-24 border-teal-200/80 shadow-sm"
              >
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Nộp báo cáo mới</CardTitle>
                </CardHeader>
                <CardContent>
                  <ProjectReportSubmissionForm
                    workspacePeriod={period}
                    initialProjectId={formProjectId || undefined}
                    onSubmitted={() => {
                      setFormProjectId('');
                      void reload();
                    }}
                  />
                </CardContent>
              </Card>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  className="border-white/80 bg-white pl-9 shadow-sm"
                  placeholder="Lọc danh sách dự án (mã, tên, KST…)"
                  value={listSearch}
                  onChange={(e) => setListSearch(e.target.value)}
                />
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <Card className="border-amber-200/70 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base text-amber-950">
                      Chưa nộp ({pendingFiltered.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="max-h-[420px] space-y-2 overflow-y-auto p-4 pt-0">
                    {pendingFiltered.length === 0 ? (
                      <p className="text-sm text-slate-500">
                        {summary.pendingCount === 0
                          ? 'Tất cả dự án đã nộp tháng này.'
                          : 'Không khớp bộ lọc.'}
                      </p>
                    ) : (
                      pendingFiltered.map((p) => (
                        <div
                          key={p.projectId}
                          className="flex items-start justify-between gap-2 rounded-lg border border-amber-100 bg-amber-50/50 p-3"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-bold leading-snug text-slate-900">
                              {p.projectName}
                            </p>
                            <p className="text-xs text-slate-500">
                              {p.projectCode}
                              {p.customerName
                                ? ` · ${p.customerName}`
                                : null}
                            </p>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="shrink-0"
                            onClick={() => {
                              setFormProjectId(p.projectId);
                              document
                                .getElementById('report-submit-form-anchor')
                                ?.scrollIntoView({ behavior: 'smooth' });
                            }}
                          >
                            Nộp
                          </Button>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>

                <Card className="border-emerald-200/70 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base text-emerald-950">
                      Đã nộp ({submittedFiltered.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="max-h-[420px] space-y-2 overflow-y-auto p-4 pt-0">
                    {submittedFiltered.length === 0 ? (
                      <p className="text-sm text-slate-500">
                        Chưa có báo cáo trong tháng này.
                      </p>
                    ) : (
                      submittedFiltered.map((row) => (
                        <div
                          key={row.submissionId}
                          className="rounded-lg border border-emerald-100 bg-white p-3"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-bold text-slate-900">
                                {row.projectName}
                              </p>
                              <p className="text-xs text-slate-500">
                                {row.projectCode} ·{' '}
                                {new Date(row.submittedAt).toLocaleString(
                                  'vi-VN',
                                )}
                              </p>
                              <p className="mt-1 text-sm tabular-nums font-medium text-emerald-900">
                                {formatCurrencyVND(
                                  row.totalReportedPlannedAmount,
                                )}
                                <span className="ml-2 text-xs font-normal text-slate-500">
                                  {row.lineCount} HĐ · {row.fileCount} file
                                </span>
                              </p>
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="shrink-0 text-slate-600"
                              onClick={() => openDetail(row.submissionId)}
                            >
                              Chi tiết
                              <ChevronRight className="ml-0.5 h-4 w-4" />
                            </Button>
                          </div>
                          {(row.files ?? []).length > 0 ? (
                            <div className="mt-2 flex flex-wrap gap-1.5 border-t border-emerald-50 pt-2">
                              {(row.files ?? []).map((f) => (
                                <ReportSubmissionFileDownload
                                  key={f.id}
                                  fileId={f.id}
                                  fileName={f.fileName}
                                  sizeBytes={f.sizeBytes}
                                  variant="button"
                                />
                              ))}
                            </div>
                          ) : (
                            <p className="mt-2 border-t border-emerald-50 pt-2 text-xs text-slate-500">
                              Không có file đính kèm
                            </p>
                          )}
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          ) : null}
        </QueryState>
      </MonthlyWorkspaceShell>

      <ReportSubmissionDetailDialog
        submissionId={detailId}
        open={detailOpen}
        onOpenChange={(open) => {
          if (!open) closeDetail();
          else setDetailOpen(true);
        }}
        onDeleted={() => {
          closeDetail();
          void reload();
        }}
      />
    </>
  );
}
