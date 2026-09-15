'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { dashboardApi } from '@/lib/api';
import { formatCurrencyVND, formatPeriod } from '@/lib/format';
import type { DashboardOverview } from '@/lib/types';
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
  const [fromPeriod, setFromPeriod] = useState('');
  const [toPeriod, setToPeriod] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const overview = await dashboardApi.overview();
      setData(overview);
      if (overview.monthlyTrend.length > 0) {
        setFromPeriod((prev) => prev || overview.monthlyTrend[0].period);
        setToPeriod(
          (prev) =>
            prev ||
            overview.monthlyTrend[overview.monthlyTrend.length - 1].period,
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

  const applyPreset = (preset: 'all' | 'month' | '3m' | '6m' | 'ytd') => {
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
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Metric
                label="Tổng giá trị HĐ"
                value={formatCurrencyVND(data.summary.contractValue)}
                hint={`${data.summary.projectCount} dự án · ${data.summary.contractCount} hợp đồng`}
              />
              <Metric
                label="Kế hoạch nghiệm thu"
                value={formatCurrencyVND(data.summary.totalPlanned)}
                hint={`Hoàn thành KH ${data.summary.planCompletionPercent}%`}
              />
              <Metric
                label="Đã nghiệm thu"
                value={formatCurrencyVND(data.summary.totalAccepted)}
                hint={`Tỉ lệ ${data.summary.acceptanceRatePercent}% giá trị HĐ`}
                tone={
                  Number(data.summary.acceptanceRatePercent) >= 70
                    ? 'success'
                    : 'warning'
                }
              />
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
                          <TableHead className="text-right">Kế hoạch</TableHead>
                          <TableHead className="text-right">Đã NT</TableHead>
                          <TableHead className="text-right">Đã thu</TableHead>
                          <TableHead className="text-right">Chưa NT</TableHead>
                          <TableHead className="text-right">Chưa thu</TableHead>
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
                              {formatCurrencyVND(row.accepted)}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatCurrencyVND(row.collected)}
                            </TableCell>
                            <TableCell className="text-right text-amber-700">
                              {formatCurrencyVND(row.remainingAcceptance)}
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
