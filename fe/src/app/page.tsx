'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { dashboardApi } from '@/lib/api';
import { formatCurrencyVND, formatPeriod } from '@/lib/format';
import type { DashboardMonthlyPoint, DashboardOverview } from '@/lib/types';
import { QueryState } from '@/components/shared/query-state';
import {
  DashboardPieChart,
  DashboardProjectBars,
  DashboardTrendChart,
  filterMonthlyTrend,
  type ChartType,
} from '@/components/dashboard/dashboard-charts';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

function Metric({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'danger' | 'success' | 'warning';
}) {
  return (
    <div
      className={cn(
        'rounded-lg border border-slate-200 bg-white p-4',
        tone === 'danger' && 'border-red-200 bg-red-50/50',
        tone === 'success' && 'border-emerald-200 bg-emerald-50/40',
        tone === 'warning' && 'border-amber-200 bg-amber-50/50',
      )}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p
        className={cn(
          'mt-1 text-xl font-semibold text-slate-900',
          tone === 'danger' && 'text-red-700',
          tone === 'success' && 'text-emerald-800',
          tone === 'warning' && 'text-amber-800',
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

function currentPeriod() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function shiftPeriod(period: string, deltaMonths: number) {
  const [y, m] = period.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + deltaMonths, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export default function HomePage() {
  const [data, setData] = useState<DashboardOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chartType, setChartType] = useState<ChartType>('bar');
  const [companyChart, setCompanyChart] = useState<
    'cumulative' | 'completion' | 'monthly'
  >('cumulative');
  const [fromPeriod, setFromPeriod] = useState('');
  const [toPeriod, setToPeriod] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const overview = await dashboardApi.overview();
      setData(overview);
      if (overview.monthlyTrend.length > 0) {
        const periods = overview.monthlyTrend.map((item) => item.period);
        const latest = overview.monthlyTrend[overview.monthlyTrend.length - 1].period;
        const initialPeriod = periods.includes(currentPeriod())
          ? currentPeriod()
          : latest;
        setFromPeriod((prev) => prev || initialPeriod);
        setToPeriod(
          (prev) =>
            prev || initialPeriod,
        );
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Không tải được dashboard';
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

  const periodOptions = useMemo(
    () => data?.monthlyTrend.map((item) => item.period) ?? [],
    [data],
  );

  const filteredTrend = useMemo(() => {
    if (!data) return [];
    return filterMonthlyTrend(data.monthlyTrend, fromPeriod, toPeriod);
  }, [data, fromPeriod, toPeriod]);

  const companyCumulativeTrend = useMemo(() => {
    let planned = 0;
    let accepted = 0;
    let collected = 0;
    return filteredTrend.map((row): DashboardMonthlyPoint => {
      planned += Number(row.planned) || 0;
      accepted += Number(row.accepted) || 0;
      collected += Number(row.collected) || 0;
      return {
        period: row.period,
        planned: String(planned),
        accepted: String(accepted),
        collected: String(collected),
      };
    });
  }, [filteredTrend]);

  const companyPlanCompletionSlices = useMemo(() => {
    const last = companyCumulativeTrend[companyCumulativeTrend.length - 1];
    const planned = Number(last?.planned ?? 0);
    const accepted = Number(last?.accepted ?? 0);
    const completed = Math.min(Math.max(accepted, 0), planned);
    return [
      { key: 'PLAN_COMPLETED', label: 'Đã nghiệm thu', amount: String(completed) },
      {
        key: 'PLAN_REMAINING',
        label: 'Còn thiếu so với kế hoạch',
        amount: String(Math.max(planned - completed, 0)),
      },
    ];
  }, [companyCumulativeTrend]);

  const applyPreset = (
    preset: 'all' | 'month' | 'previousMonth' | '3m' | '6m' | 'ytd',
  ) => {
    if (!data || data.monthlyTrend.length === 0) return;
    const first = data.monthlyTrend[0].period;
    const last = data.monthlyTrend[data.monthlyTrend.length - 1].period;
    const now = currentPeriod();

    if (preset === 'all') {
      setFromPeriod(first);
      setToPeriod(last);
      return;
    }
    if (preset === 'month') {
      const period = periodOptions.includes(now) ? now : last;
      setFromPeriod(period);
      setToPeriod(period);
      return;
    }
    if (preset === 'previousMonth') {
      const previous = shiftPeriod(now, -1);
      const period = periodOptions.includes(previous) ? previous : first;
      setFromPeriod(period);
      setToPeriod(period);
      return;
    }
    if (preset === '3m') {
      const from = shiftPeriod(last, -2);
      setFromPeriod(from < first ? first : from);
      setToPeriod(last);
      return;
    }
    if (preset === '6m') {
      const from = shiftPeriod(last, -5);
      setFromPeriod(from < first ? first : from);
      setToPeriod(last);
      return;
    }
    const yearStart = `${last.slice(0, 4)}-01`;
    setFromPeriod(yearStart < first ? first : yearStart);
    setToPeriod(last);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">Dashboard</p>
          <h2 className="font-serif text-3xl font-semibold text-slate-900">
            Tổng quan toàn hệ thống
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Kế hoạch · Nghiệm thu · Thu tiền — theo dõi tình hình các dự án
          </p>
        </div>
        <Button variant="outline" onClick={() => load()} disabled={loading}>
          <RefreshCw className="h-4 w-4" />
          Làm mới
        </Button>
      </div>

      <QueryState
        loading={loading}
        error={error}
        empty={!data}
        emptyMessage="Chưa có dữ liệu thống kê."
        onRetry={load}
      >
        {data && (
          <>
            <details open className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg px-1 py-2 text-sm font-semibold text-slate-900 [&::-webkit-details-marker]:hidden">
                <span>Tổng quan lũy kế & chậm trễ</span>
                <span className="text-xs font-normal text-slate-500">Bấm để thu gọn / mở rộng</span>
              </summary>
              <div className="mt-2 space-y-5">
                <section>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Quy mô hợp đồng</p>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Metric
                label="Tổng giá trị HĐ"
                value={formatCurrencyVND(data.summary.contractValue)}
                hint={`${data.summary.projectCount} dự án · ${data.summary.contractCount} hợp đồng`}
              />
                  </div>
                </section>

                <section>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Tiến độ kế hoạch đến kỳ</p>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Metric
                label="KH NT đến kỳ hiện tại"
                value={formatCurrencyVND(data.summary.plannedToDate)}
                hint={`Kỳ ${data.summary.currentPeriod} · tổng KH ${formatCurrencyVND(data.summary.totalPlanned)}`}
              />
              <Metric
                label="Đã nộp HS đến kỳ"
                value={formatCurrencyVND(data.summary.submittedToDate)}
                hint={`So với KH: ${formatCurrencyVND(data.summary.submittedToDate)} / ${formatCurrencyVND(data.summary.plannedToDate)}`}
                tone={
                  Number(data.summary.remainingPlanAfterPending) === 0
                    ? 'success'
                    : 'warning'
                }
              />
              <Metric
                label="Chậm trễ: chờ nộp HS"
                value={formatCurrencyVND(data.summary.pendingSubmissionToDate)}
                hint="Đã lên đợt nghiệm thu nhưng chưa nộp hồ sơ"
                tone={
                  Number(data.summary.pendingSubmissionToDate) > 0
                    ? 'danger'
                    : undefined
                }
              />
              <Metric
                label="Chậm trễ: chưa đạt KH"
                value={formatCurrencyVND(data.summary.remainingPlanAfterPending)}
                hint={
                  Number(data.summary.remainingPlanAfterPending) > 0
                    ? 'Phần kế hoạch đến kỳ chưa có thực hiện/nghiệm thu'
                    : 'Không còn phần thiếu kế hoạch'
                }
                tone={
                  Number(data.summary.remainingPlanAfterPending) > 0
                    ? 'danger'
                    : 'success'
                }
              />
                  </div>
                </section>

                <section>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Nghiệm thu & dòng tiền</p>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Metric
                label="Đã thu tiền"
                value={formatCurrencyVND(data.summary.totalCollected)}
                hint={`Tỉ lệ thu ${data.summary.collectionRatePercent}% trên đã NT`}
                tone="success"
              />
              <Metric
                label="Chưa nghiệm thu"
                value={
                  data.summary.remainingAcceptance === 'OVER_CONTRACT_VALUE'
                    ? 'Vượt giá trị HĐ'
                    : formatCurrencyVND(data.summary.remainingAcceptance)
                }
                hint="Giá trị HĐ − đã nghiệm thu"
                tone="warning"
              />
              <Metric
                label="Chưa thu tiền"
                value={formatCurrencyVND(data.summary.outstandingCollection)}
                hint="Đã NT nhưng CĐT chưa thanh toán"
                tone={
                  Number(data.summary.outstandingCollection) > 0
                    ? 'danger'
                    : 'success'
                }
              />
                  </div>
                </section>

                <section>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Chỉ số hiệu quả</p>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Metric
                label="% hoàn thành theo KH"
                value={`${data.summary.planCompletionPercent}%`}
                hint="Đã NT / Tổng kế hoạch"
              />
              <Metric
                label="% thu trên đã NT"
                value={`${data.summary.collectionRatePercent}%`}
                hint="Đã thu / Đã nghiệm thu"
              />
                  </div>
                </section>
              </div>
            </details>

            <details open className="rounded-xl border border-slate-200 bg-white">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-6 py-4 [&::-webkit-details-marker]:hidden">
                <div>
                  <p className="text-base font-semibold text-slate-900">
                    Kế hoạch và thực hiện toàn công ty · Kỳ {formatPeriod(data.summary.currentPeriod)}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">Kế hoạch tháng, thực hiện, nghiệm thu và dòng tiền</p>
                </div>
                <span className="text-xs text-slate-500">Thu gọn / mở rộng</span>
              </summary>
              <CardHeader className="sr-only">
                <CardTitle className="text-base">
                  Kế hoạch và thực hiện toàn công ty · Kỳ {formatPeriod(data.summary.currentPeriod)}
                </CardTitle>
                <p className="text-sm text-slate-500">
                  Kế hoạch là tổng kế hoạch NT trong tháng; thực hiện lấy từ “Thực hiện” từng hợp đồng; nghiệm thu chỉ tính đợt đã nộp hồ sơ.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4">
                  <section>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Tiến độ thực hiện & nghiệm thu</p>
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <Metric
                    label="Kế hoạch tháng"
                    value={formatCurrencyVND(data.summary.currentPlanned)}
                    hint="Tổng kế hoạch nghiệm thu kỳ này"
                  />
                  <Metric
                    label="Đã thực hiện"
                    value={formatCurrencyVND(data.summary.currentActualWork)}
                    hint={`Đạt ${data.summary.currentExecutionRatePercent}% KH · còn ${formatCurrencyVND(data.summary.currentUnperformed)}`}
                    tone={Number(data.summary.currentUnperformed) > 0 ? 'warning' : 'success'}
                  />
                  <Metric
                    label="Đã nộp HS / nghiệm thu"
                    value={formatCurrencyVND(data.summary.currentAccepted)}
                    hint={`Đạt ${data.summary.currentAcceptanceRatePercent}% KH tháng`}
                    tone={Number(data.summary.currentUnaccepted) > 0 ? 'warning' : 'success'}
                  />
                  <Metric
                    label="Chậm trễ: chưa đạt KH tháng"
                    value={formatCurrencyVND(data.summary.currentUnaccepted)}
                    hint={`Trong đó chờ nộp HS: ${formatCurrencyVND(data.summary.currentPendingSubmission)}`}
                    tone={Number(data.summary.currentUnaccepted) > 0 ? 'danger' : 'success'}
                  />
                    </div>
                  </section>
                  <section>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Dòng tiền kỳ này</p>
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <Metric
                    label="Tiền đã về"
                    value={formatCurrencyVND(data.summary.currentCollected)}
                    hint={`Thu ${data.summary.currentCollectionRatePercent}% trên đã NT`}
                    tone="success"
                  />
                  <Metric
                    label="Còn phải thu"
                    value={formatCurrencyVND(data.summary.currentOutstandingCollection)}
                    hint="Đã nộp HS/NT nhưng chưa thu được tiền"
                    tone={Number(data.summary.currentOutstandingCollection) > 0 ? 'danger' : 'success'}
                  />
                    </div>
                  </section>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div>
                    <p className="mb-2 text-sm font-medium text-slate-800">
                      Tiến độ kế hoạch tháng
                    </p>
                    <DashboardPieChart
                      data={[
                        { key: 'ACTUAL_WORK', label: 'Đã thực hiện', amount: data.summary.currentActualWork },
                        { key: 'UNPERFORMED', label: 'Chưa thực hiện', amount: data.summary.currentUnperformed },
                      ]}
                    />
                  </div>
                  <div>
                    <p className="mb-2 text-sm font-medium text-slate-800">
                      Nghiệm thu và dòng tiền tháng
                    </p>
                    <DashboardPieChart
                      data={[
                        { key: 'COLLECTED', label: 'Tiền đã về', amount: data.summary.currentCollected },
                        { key: 'OUTSTANDING', label: 'Còn phải thu', amount: data.summary.currentOutstandingCollection },
                        { key: 'PENDING_SUBMISSION', label: 'Chậm: chờ nộp HS', amount: data.summary.currentPendingSubmission },
                        { key: 'UNACCEPTED', label: 'Chậm: chưa đạt KH', amount: data.summary.currentUnaccepted },
                      ]}
                    />
                  </div>
                </div>
              </CardContent>
            </details>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  Bộ lọc thời gian biểu đồ
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      { key: 'all', label: 'Tất cả' },
                      { key: 'month', label: 'Tháng này' },
                      { key: 'previousMonth', label: 'Tháng trước' },
                      { key: '3m', label: '3 tháng' },
                      { key: '6m', label: '6 tháng' },
                      { key: 'ytd', label: 'Từ đầu năm' },
                    ] as const
                  ).map((item) => (
                    <Button
                      key={item.key}
                      size="sm"
                      variant="outline"
                      onClick={() => applyPreset(item.key)}
                    >
                      {item.label}
                    </Button>
                  ))}
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="space-y-1">
                    <Label>Từ tháng</Label>
                    <Select
                      value={fromPeriod}
                      onChange={(e) => {
                        const value = e.target.value;
                        setFromPeriod(value);
                        if (toPeriod && value > toPeriod) setToPeriod(value);
                      }}
                    >
                      {periodOptions.map((period) => (
                        <option key={period} value={period}>
                          {formatPeriod(period)}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Đến tháng</Label>
                    <Select
                      value={toPeriod}
                      onChange={(e) => {
                        const value = e.target.value;
                        setToPeriod(value);
                        if (fromPeriod && value < fromPeriod) {
                          setFromPeriod(value);
                        }
                      }}
                    >
                      {periodOptions.map((period) => (
                        <option key={period} value={period}>
                          {formatPeriod(period)}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="flex items-end sm:col-span-2">
                    <p className="text-sm text-slate-600">
                      Đang xem:{' '}
                      <span className="font-semibold text-slate-900">
                        {formatPeriod(fromPeriod)} → {formatPeriod(toPeriod)}
                      </span>{' '}
                      ({filteredTrend.length} kỳ)
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
              <Card className="overflow-hidden">
                <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle className="text-base">
                      Kế hoạch · Nghiệm thu · Thu tiền theo tháng
                    </CardTitle>
                    <p className="text-sm text-slate-500">
                      Chọn loại biểu đồ · bấm vào chart để xem số
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        { key: 'bar', label: 'Cột' },
                        { key: 'line', label: 'Đường' },
                        { key: 'pie', label: 'Tròn' },
                      ] as const
                    ).map((item) => (
                      <Button
                        key={item.key}
                        size="sm"
                        variant={chartType === item.key ? 'default' : 'outline'}
                        onClick={() => setChartType(item.key)}
                      >
                        {item.label}
                      </Button>
                    ))}
                  </div>
                </CardHeader>
                <CardContent>
                  {chartType === 'pie' ? (
                    <DashboardPieChart data={data.statusBreakdown} />
                  ) : (
                    <DashboardTrendChart
                      type={chartType}
                      data={filteredTrend}
                    />
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Cơ cấu theo trạng thái
                  </CardTitle>
                  <p className="text-sm text-slate-500">
                    Đã thu · Chờ thu · Chưa NT — bấm để xem số
                  </p>
                </CardHeader>
                <CardContent>
                  <DashboardPieChart data={data.statusBreakdown} />
                </CardContent>
              </Card>
            </div>

            <details open className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-6 py-4 [&::-webkit-details-marker]:hidden">
                <div>
                  <p className="text-base font-semibold text-slate-900">Kế hoạch toàn công ty · Lũy kế theo kỳ</p>
                  <p className="mt-1 text-sm text-slate-500">Áp dụng theo khoảng thời gian đang chọn phía trên</p>
                </div>
                <span className="text-xs text-slate-500">Thu gọn / mở rộng</span>
              </summary>
              <CardHeader className="sr-only">
                <CardTitle className="text-base">
                  Kế hoạch toàn công ty · Lũy kế theo kỳ
                </CardTitle>
                <p className="text-sm text-slate-500">
                  Toàn bộ biểu đồ áp dụng cho khoảng thời gian đang chọn phía trên
                </p>
              </CardHeader>
              <CardContent>
                <div className="mb-4 flex flex-wrap gap-2">
                  {[
                    { key: 'cumulative', label: 'Đường lũy kế' },
                    { key: 'completion', label: 'Tròn hoàn thành KH' },
                    { key: 'monthly', label: 'Cột theo kỳ' },
                  ].map((item) => (
                    <Button
                      key={item.key}
                      size="sm"
                      variant={companyChart === item.key ? 'default' : 'outline'}
                      onClick={() => setCompanyChart(item.key as typeof companyChart)}
                    >
                      {item.label}
                    </Button>
                  ))}
                </div>
                <div className="rounded-lg border border-slate-200 p-4">
                  {companyChart === 'cumulative' ? (
                    <>
                      <p className="mb-1 text-sm font-semibold text-slate-900">Lũy kế kế hoạch / nghiệm thu / thu tiền</p>
                      <p className="mb-3 text-xs text-slate-500">Xem công ty đang đạt hay chậm kế hoạch tích lũy tới từng kỳ.</p>
                      <DashboardTrendChart type="line" data={companyCumulativeTrend} />
                    </>
                  ) : null}
                  {companyChart === 'completion' ? (
                    <>
                      <p className="mb-1 text-sm font-semibold text-slate-900">Mức hoàn thành kế hoạch toàn công ty</p>
                      <p className="mb-3 text-xs text-slate-500">Đã nghiệm thu so với tổng kế hoạch trong khoảng đang xem.</p>
                      <DashboardPieChart data={companyPlanCompletionSlices} />
                    </>
                  ) : null}
                  {companyChart === 'monthly' ? (
                    <>
                      <p className="mb-1 text-sm font-semibold text-slate-900">Biến động theo từng kỳ</p>
                      <p className="mb-3 text-xs text-slate-500">So sánh số phát sinh kế hoạch, nghiệm thu và tiền về ở từng tháng.</p>
                      <DashboardTrendChart type="bar" data={filteredTrend} />
                    </>
                  ) : null}
                </div>
              </CardContent>
            </details>

            <div className="grid gap-4 xl:grid-cols-[1fr_1.2fr]">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Theo dự án</CardTitle>
                </CardHeader>
                <CardContent>
                  <DashboardProjectBars data={data.byProject} />
                </CardContent>
              </Card>

              <Card className="overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-base">Chi tiết dự án</CardTitle>
                  <Button asChild size="sm" variant="outline">
                    <Link href="/projects">
                      Xem dự án
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Dự án</TableHead>
                          <TableHead className="text-right">Giá trị HĐ</TableHead>
                          <TableHead className="text-right">KH đến kỳ</TableHead>
                          <TableHead className="text-right">Thực hiện</TableHead>
                          <TableHead className="text-right">Đã nộp HS</TableHead>
                          <TableHead className="text-right">Chậm: chờ HS</TableHead>
                          <TableHead className="text-right">Thiếu KH</TableHead>
                          <TableHead className="text-right">Đã thu</TableHead>
                          <TableHead className="text-right">Còn thu</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.byProject.map((row) => (
                          <TableRow key={row.projectId}>
                            <TableCell className="font-medium">
                              <Link
                                href={`/projects/${row.projectId}`}
                                className="underline-offset-2 hover:underline"
                              >
                                {row.projectCode}
                              </Link>
                              <div className="text-xs text-slate-500">
                                {row.projectName}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              {formatCurrencyVND(row.contractValue)}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatCurrencyVND(row.planned)}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatCurrencyVND(row.actualWork)}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatCurrencyVND(row.accepted)}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatCurrencyVND(row.pendingSubmission)}
                            </TableCell>
                            <TableCell className="text-right text-rose-700">
                              {formatCurrencyVND(row.planShortfall)}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatCurrencyVND(row.collected)}
                            </TableCell>
                            <TableCell className="text-right text-red-600">
                              {formatCurrencyVND(row.outstandingCollection)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>

            {data.alerts.length > 0 ? (
              <Card className="border-amber-200 bg-amber-50/50">
                <CardHeader>
                  <CardTitle className="text-base">
                    Cảnh báo cần theo dõi
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="list-disc space-y-1 pl-5 text-sm text-amber-950">
                    {data.alerts.slice(0, 8).map((alert) => (
                      <li
                        key={`${alert.type}-${alert.projectCode}-${alert.message}`}
                      >
                        {alert.message}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href="/contracts">Danh sách hợp đồng</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href="/customers">Khách hàng</Link>
              </Button>
            </div>
          </>
        )}
      </QueryState>
    </div>
  );
}
