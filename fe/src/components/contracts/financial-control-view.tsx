'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Plus, RefreshCw, Save } from 'lucide-react';
import { toast } from 'sonner';
import {
  financialControlApi,
  revenuePlansApi,
} from '@/lib/api';
import {
  formatCurrencyVND,
  formatDate,
  formatPeriod,
  isNegativeDecimal,
} from '@/lib/format';
import {
  isValidAmount,
  isValidPeriod,
  normalizeAmount,
} from '@/lib/csv';
import type { FinancialControlResponse } from '@/lib/types';
import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { QueryState } from '@/components/shared/query-state';
import {
  BottleneckBadge,
  ScheduleStatusBadge,
} from '@/components/shared/status-badges';
import { FinancialControlChart } from '@/components/contracts/financial-control-chart';
import { CollectionsSection } from '@/components/contracts/collections-section';
import {
  buildPeriodOptions,
  CsvDataTransfer,
} from '@/components/shared/csv-data-transfer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MoneyInput } from '@/components/ui/money-input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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

const PERIOD_OPTIONS = buildPeriodOptions();

const PLAN_CSV_COLUMNS = [
  {
    key: 'period',
    header: 'Ky',
    aliases: ['period', 'Kỳ', 'ky', 'thang'],
    required: true,
    sample: '2026-01',
    type: 'period' as const,
    options: PERIOD_OPTIONS,
  },
  {
    key: 'plannedAmount',
    header: 'KeHoach',
    aliases: ['plannedAmount', 'Kế hoạch', 'so tien', 'amount'],
    required: true,
    sample: '625000000',
    type: 'money' as const,
  },
  {
    key: 'note',
    header: 'GhiChu',
    aliases: ['note', 'Ghi chú', 'ghi chu'],
    sample: 'Kế hoạch tháng 1',
  },
];

function MoneyCell({
  value,
  highlightNegative,
}: {
  value: string;
  highlightNegative?: boolean;
}) {
  if (value === 'OVER_CONTRACT_VALUE') {
    return <span className="font-medium text-red-600">Vượt giá trị HĐ</span>;
  }
  const negative = highlightNegative && isNegativeDecimal(value);
  return (
    <span className={negative ? 'font-medium text-red-600' : undefined}>
      {formatCurrencyVND(value)}
    </span>
  );
}

function SummaryCard({
  label,
  value,
  hint,
  tone,
  large,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'danger' | 'success' | 'warning' | 'default';
  large?: boolean;
}) {
  const isPercent = value.trim().endsWith('%');
  const display = isPercent
    ? value
    : value === 'OVER_CONTRACT_VALUE'
      ? 'Vượt giá trị HĐ'
      : formatCurrencyVND(value);

  return (
    <div
      className={cn(
        'rounded-lg border border-slate-200 bg-white p-4',
        tone === 'danger' && 'border-red-200 bg-red-50/60',
        tone === 'success' && 'border-emerald-200 bg-emerald-50/50',
        tone === 'warning' && 'border-amber-200 bg-amber-50/60',
      )}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p
        className={cn(
          'mt-1 font-semibold',
          large ? 'text-2xl' : 'text-lg',
          tone === 'danger' && 'text-red-700',
          tone === 'success' && 'text-emerald-800',
          tone === 'warning' && 'text-amber-800',
          !tone || tone === 'default' ? 'text-slate-900' : undefined,
        )}
      >
        {display}
      </p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

export function FinancialControlView({ contractId }: { contractId: string }) {
  const [data, setData] = useState<FinancialControlResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draftPlans, setDraftPlans] = useState<
    Array<{ period: string; plannedAmount: string; note: string }>
  >([]);
  const [planPeriod, setPlanPeriod] = useState('');
  const [planAmount, setPlanAmount] = useState('');
  const [planNote, setPlanNote] = useState('');
  const [actualWorkDrafts, setActualWorkDrafts] = useState<
    Record<string, string>
  >({});
  const [savingPeriod, setSavingPeriod] = useState<string | null>(null);
  const [planBusy, setPlanBusy] = useState(false);
  const [planSetupOpen, setPlanSetupOpen] = useState(true);
  const [progressOpen, setProgressOpen] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await financialControlApi.get(contractId);
      setData(response);
      setActualWorkDrafts(
        Object.fromEntries(
          response.rows.map((row) => [row.period, row.actualWorkAmount]),
        ),
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Không tải được dữ liệu tài chính';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [contractId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const handleGeneratePeriods = async () => {
    setPlanBusy(true);
    try {
      const { periods } = await financialControlApi.generatePeriods(contractId);
      setDraftPlans(
        periods.map((period) => ({
          period,
          plannedAmount: '0',
          note: '',
        })),
      );
      toast.success(`Đã tạo ${periods.length} kỳ theo thời hạn hợp đồng`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Không tạo được kỳ');
    } finally {
      setPlanBusy(false);
    }
  };

  const handleEqualSplitDraft = async () => {
    setPlanBusy(true);
    try {
      let periods = draftPlans.map((item) => item.period);
      if (periods.length === 0) {
        const generated = await financialControlApi.generatePeriods(contractId);
        periods = generated.periods;
      }
      const draft = await financialControlApi.draftEqualSplit(contractId, {
        periods,
        firstPeriodZero: true,
      });
      setDraftPlans(
        draft.items.map((item) => ({
          period: item.period,
          plannedAmount: item.plannedAmount,
          note: item.note ?? '',
        })),
      );
      toast.success('Đã tạo bản nháp chia đều — vui lòng kiểm tra trước khi lưu');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Không chia đều được');
    } finally {
      setPlanBusy(false);
    }
  };

  const handleSaveDraftPlans = async () => {
    if (draftPlans.length === 0) {
      toast.error('Chưa có kế hoạch để lưu');
      return;
    }
    setPlanBusy(true);
    try {
      await financialControlApi.bulkPlans(contractId, {
        items: draftPlans.map((item) => ({
          period: item.period,
          plannedAmount: Number(item.plannedAmount),
          note: item.note || undefined,
        })),
      });
      toast.success('Đã lưu kế hoạch theo tháng');
      setDraftPlans([]);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Lưu kế hoạch thất bại');
    } finally {
      setPlanBusy(false);
    }
  };

  const handleAddSinglePlan = async () => {
    if (!planPeriod || !planAmount) {
      toast.error('Nhập kỳ và số tiền kế hoạch');
      return;
    }
    setPlanBusy(true);
    try {
      await revenuePlansApi.create(contractId, {
        period: planPeriod,
        plannedAmount: Number(planAmount),
        note: planNote || undefined,
      });
      toast.success('Đã thêm kế hoạch tháng');
      setPlanPeriod('');
      setPlanAmount('');
      setPlanNote('');
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Thêm kế hoạch thất bại');
    } finally {
      setPlanBusy(false);
    }
  };

  const handleImportPlansCsv = async (rows: Array<Record<string, string>>) => {
    await financialControlApi.bulkPlans(contractId, {
      items: rows.map((row) => ({
        period: row.period.trim(),
        plannedAmount: Number(normalizeAmount(row.plannedAmount)),
        note: row.note?.trim() || undefined,
      })),
    });
    await load();
  };

  const handleSaveActualWork = async (period: string) => {
    const amount = actualWorkDrafts[period] ?? '0';
    if (!/^\d+(\.\d{1,2})?$/.test(amount)) {
      toast.error('Số tiền thực hiện không hợp lệ');
      return;
    }

    setSavingPeriod(period);
    try {
      const row = data?.rows.find((item) => item.period === period);
      if (row?.monthlyFinancialId) {
        await financialControlApi.updateMonthlyFinancial(row.monthlyFinancialId, {
          actualWorkAmount: Number(amount),
        });
      } else {
        await financialControlApi.createMonthlyFinancial(contractId, {
          period,
          actualWorkAmount: Number(amount),
        });
      }
      toast.success(`Đã lưu thực hiện tháng ${formatPeriod(period)}`);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Lưu thất bại');
    } finally {
      setSavingPeriod(null);
    }
  };

  return (
    <div className="space-y-4">
      <QueryState
        loading={loading}
        error={error}
        empty={!data}
        emptyMessage="Không tải được dữ liệu kiểm soát tài chính."
        onRetry={load}
      >
        {data && (
          <>
            <Breadcrumbs
              items={[
                { label: 'Quản lý dự án' },
                { label: 'Hợp đồng', href: '/contracts' },
                {
                  label: data.contract.contractNo,
                  href: `/contracts/${contractId}`,
                },
                { label: 'Quản lý tài chính' },
              ]}
            />

            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <Button asChild variant="ghost" size="sm" className="-ml-2 mb-1">
                  <Link href={`/contracts/${contractId}`}>
                    <ArrowLeft className="h-4 w-4" />
                    Quay lại hợp đồng
                  </Link>
                </Button>
                <p className="text-sm text-slate-500">{data.contract.contractNo}</p>
                <h2 className="font-serif text-2xl font-semibold">
                  Quản lý tài chính theo tháng
                </h2>
                <p className="mt-1 text-sm text-slate-600">{data.contract.name}</p>
              </div>
              <Button variant="outline" onClick={() => load()} disabled={loading}>
                <RefreshCw className="h-4 w-4" />
                Làm mới
              </Button>
            </div>

            {data.warnings.length > 0 ? (
              <Card className="border-amber-200 bg-amber-50/80">
                <CardContent className="py-4">
                  <ul className="list-disc space-y-1 pl-5 text-sm text-amber-900">
                    {data.warnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ) : null}

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Thông tin hợp đồng</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <p className="text-xs uppercase text-slate-500">Giá trị HĐ</p>
                  <p className="font-medium">
                    {formatCurrencyVND(data.summary.contractValue)}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase text-slate-500">Thời hạn</p>
                  <p className="font-medium">
                    {formatDate(data.timeline.startDate)} —{' '}
                    {formatDate(data.timeline.endDate)}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase text-slate-500">Dự án</p>
                  <p className="font-medium">
                    {data.contract.project
                      ? `${data.contract.project.code} — ${data.contract.project.name}`
                      : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase text-slate-500">Kỳ hiện tại</p>
                  <p className="font-medium">
                    {formatPeriod(data.timeline.currentPeriod)}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Tổng quan tài chính</CardTitle>
                <p className="text-sm text-slate-600">
                  {data.summary.overContractValue
                    ? 'Cảnh báo: đã nghiệm thu vượt giá trị hợp đồng.'
                    : isNegativeDecimal(data.summary.scheduleVariance)
                      ? `Chậm kế hoạch lũy kế ${formatCurrencyVND(data.summary.scheduleVariance.replace(/^-/, ''))} — cần đẩy nghiệm thu.`
                      : `Còn ${
                          data.summary.remainingAcceptance ===
                          'OVER_CONTRACT_VALUE'
                            ? '0'
                            : formatCurrencyVND(
                                data.summary.remainingAcceptance,
                              )
                        } chưa nghiệm thu · Còn phải thu ${formatCurrencyVND(data.summary.outstandingCollection)}.`}
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <SummaryCard
                    label="KH NT đến kỳ hiện tại"
                    value={data.summary.plannedToDate ?? '0'}
                    hint={`Kỳ ${formatPeriod(data.summary.currentPeriod ?? data.timeline.currentPeriod)} · KH tháng này ${formatCurrencyVND(data.summary.monthlyRequiredAcceptance ?? '0')}`}
                    large
                  />
                  <SummaryCard
                    label="Đã nộp HS đến kỳ"
                    value={data.summary.submittedToDate ?? '0'}
                    hint={`Đã nộp / KH: ${formatCurrencyVND(data.summary.submittedToDate ?? '0')} / ${formatCurrencyVND(data.summary.plannedToDate ?? '0')}`}
                    tone={
                      Number(data.summary.remainingPlanAfterPending ?? 0) === 0
                        ? 'success'
                        : 'warning'
                    }
                    large
                  />
                  <SummaryCard
                    label="Đã lên NT, chờ nộp HS"
                    value={data.summary.pendingSubmissionToDate ?? '0'}
                    hint="Có số tiền NT nhưng chưa nộp hồ sơ"
                    tone={Number(data.summary.pendingSubmissionToDate ?? 0) > 0 ? 'warning' : undefined}
                    large
                  />
                  <SummaryCard
                    label="Còn thiếu so với KH"
                    value={data.summary.remainingPlanAfterPending ?? '0'}
                    hint={
                      Number(data.summary.remainingPlanAfterPending ?? 0) > 0
                        ? 'Thiếu so với kế hoạch lũy kế đến kỳ hiện tại'
                        : 'Đủ KH (kể cả các đợt đang chờ nộp HS)'
                    }
                    tone={
                      Number(data.summary.remainingPlanAfterPending ?? 0) > 0
                        ? 'danger'
                        : 'success'
                    }
                    large
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <SummaryCard
                    label="Giá trị hợp đồng"
                    value={data.summary.contractValue}
                  />
                  <SummaryCard
                    label="Đã nghiệm thu"
                    value={data.summary.totalAccepted}
                  />
                  <SummaryCard
                    label="Đã thu tiền"
                    value={data.summary.totalCollected}
                  />
                  <div className="rounded-lg border border-slate-200 bg-white p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Tiến độ so với KH
                    </p>
                    <p className="mt-1 text-lg font-semibold text-slate-900">
                      {data.summary.scheduleRatePercent ?? '0'}%
                    </p>
                    <div className="mt-2">
                      <ScheduleStatusBadge
                        status={data.summary.scheduleStatus}
                      />
                    </div>
                    {isNegativeDecimal(data.summary.scheduleVariance) ? (
                      <p className="mt-2 text-xs text-red-600">
                        Chậm{' '}
                        {formatCurrencyVND(
                          data.summary.scheduleVariance.replace(/^-/, ''),
                        )}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={cn(
                      'h-full rounded-full',
                      data.summary.overContractValue
                        ? 'bg-red-500'
                        : 'bg-slate-900',
                    )}
                    style={{
                      width: `${Math.min(
                        Math.max(
                          Number(data.summary.acceptanceRatePercent ?? 0),
                          0,
                        ),
                        100,
                      )}%`,
                    }}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <CardTitle className="text-base">Thiết lập kế hoạch</CardTitle>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPlanSetupOpen((open) => !open)}
                  >
                    {planSetupOpen ? 'Thu gọn' : 'Mở thiết lập'}
                  </Button>
                  <CsvDataTransfer
                    title="kế hoạch tháng"
                    filenamePrefix={`ke-hoach-${contractId.slice(0, 8)}`}
                    columns={PLAN_CSV_COLUMNS}
                    sampleRows={[
                      {
                        period: '2026-01',
                        plannedAmount: '0',
                        note: 'Tháng đầu = 0',
                      },
                      {
                        period: '2026-02',
                        plannedAmount: '625000000',
                        note: 'Kế hoạch tháng 2',
                      },
                      {
                        period: '2026-03',
                        plannedAmount: '625000000',
                        note: 'Kế hoạch tháng 3',
                      },
                    ]}
                    exportRows={(data?.rows ?? [])
                      .filter((row) => Number(row.plannedAmount) > 0 || row.revenuePlanId)
                      .map((row) => ({
                        period: row.period,
                        plannedAmount: row.plannedAmount,
                        note: row.note ?? '',
                      }))}
                    validateRow={(row) => {
                      const errors: string[] = [];
                      if (!isValidPeriod(row.period ?? '')) {
                        errors.push('Kỳ phải dạng YYYY-MM');
                      }
                      if (!isValidAmount(row.plannedAmount ?? '')) {
                        errors.push('Số tiền không hợp lệ');
                      }
                      return errors;
                    }}
                    onImport={handleImportPlansCsv}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleGeneratePeriods}
                    disabled={planBusy}
                  >
                    Tạo kế hoạch theo thời hạn HĐ
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleEqualSplitDraft}
                    disabled={planBusy}
                  >
                    Chia đều giá trị HĐ
                  </Button>
                  {draftPlans.length > 0 ? (
                    <Button size="sm" onClick={handleSaveDraftPlans} disabled={planBusy}>
                      <Save className="h-4 w-4" />
                      Lưu kế hoạch nháp
                    </Button>
                  ) : null}
                </div>
              </CardHeader>
              {planSetupOpen ? <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-4">
                  <div className="space-y-1">
                    <Label>Kỳ (YYYY-MM)</Label>
                    <Input
                      placeholder="2026-02"
                      value={planPeriod}
                      onChange={(e) => setPlanPeriod(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Kế hoạch (VND)</Label>
                    <MoneyInput
                      placeholder="1000000000"
                      value={planAmount}
                      onChange={setPlanAmount}
                    />
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <Label>Ghi chú</Label>
                    <Textarea
                      rows={1}
                      value={planNote}
                      onChange={(e) => setPlanNote(e.target.value)}
                    />
                  </div>
                </div>
                <Button size="sm" onClick={handleAddSinglePlan} disabled={planBusy}>
                  <Plus className="h-4 w-4" />
                  Thêm kế hoạch tháng
                </Button>

                {draftPlans.length > 0 ? (
                  <div className="overflow-x-auto rounded-lg border border-slate-200">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Kỳ</TableHead>
                          <TableHead>Kế hoạch</TableHead>
                          <TableHead>Ghi chú</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {draftPlans.map((item, index) => (
                          <TableRow key={item.period}>
                            <TableCell>{formatPeriod(item.period)}</TableCell>
                            <TableCell>
                              <MoneyInput
                                value={item.plannedAmount}
                                onChange={(value) => {
                                  const next = [...draftPlans];
                                  next[index] = {
                                    ...item,
                                    plannedAmount: value,
                                  };
                                  setDraftPlans(next);
                                }}
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                value={item.note}
                                onChange={(e) => {
                                  const next = [...draftPlans];
                                  next[index] = { ...item, note: e.target.value };
                                  setDraftPlans(next);
                                }}
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : null}
              </CardContent> : null}
            </Card>

            <Card className="overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between gap-3">
                <CardTitle className="text-base">
                  Theo dõi thực hiện &amp; tiến độ
                </CardTitle>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setProgressOpen((open) => !open)}
                >
                  {progressOpen ? 'Thu gọn' : 'Mở theo dõi'}
                </Button>
              </CardHeader>
              {progressOpen ? <CardContent className="p-0">
                <div className="w-full overflow-x-auto">
                  <Table className="min-w-[1400px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Kỳ</TableHead>
                        <TableHead className="text-right">Kế hoạch</TableHead>
                        <TableHead className="text-right">Thực hiện</TableHead>
                        <TableHead className="text-right">Nghiệm thu</TableHead>
                        <TableHead className="text-right">Thu tiền</TableHead>
                        <TableHead className="text-right">Lũy kế KH</TableHead>
                        <TableHead className="text-right">Lũy kế NT</TableHead>
                        <TableHead className="text-right">Lũy kế TT</TableHead>
                        <TableHead className="text-right">Còn NT</TableHead>
                        <TableHead className="text-right">Còn thu</TableHead>
                        <TableHead className="text-right">Lệch tháng</TableHead>
                        <TableHead className="text-right">Lệch lũy kế</TableHead>
                        <TableHead>Trạng thái</TableHead>
                        <TableHead>Cảnh báo</TableHead>
                        <TableHead className="text-right">Thao tác</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.rows.map((row) => (
                        <TableRow
                          key={row.period}
                          className={cn(
                            row.timelineStatus === 'CURRENT' && 'bg-sky-50/70',
                            row.timelineStatus === 'PAST' && 'bg-white',
                          )}
                        >
                          <TableCell className="font-medium">
                            {row.periodLabel}
                            <div className="text-xs text-slate-500">
                              {formatPeriod(row.period)}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <MoneyCell value={row.plannedAmount} />
                          </TableCell>
                          <TableCell className="text-right">
                            <MoneyInput
                              className="ml-auto w-36 text-right"
                              value={actualWorkDrafts[row.period] ?? ''}
                              onChange={(value) =>
                                setActualWorkDrafts((prev) => ({
                                  ...prev,
                                  [row.period]: value,
                                }))
                              }
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <MoneyCell value={row.acceptanceAmount} />
                          </TableCell>
                          <TableCell className="text-right">
                            <MoneyCell value={row.collectedAmount} />
                          </TableCell>
                          <TableCell className="text-right">
                            <MoneyCell value={row.cumulativePlanned} />
                          </TableCell>
                          <TableCell className="text-right">
                            <MoneyCell value={row.cumulativeAcceptance} />
                          </TableCell>
                          <TableCell className="text-right">
                            <MoneyCell value={row.cumulativeCollection} />
                          </TableCell>
                          <TableCell className="text-right">
                            <MoneyCell value={row.remainingAcceptance} />
                          </TableCell>
                          <TableCell className="text-right">
                            <MoneyCell value={row.remainingCollection} />
                          </TableCell>
                          <TableCell className="text-right">
                            <MoneyCell value={row.variance} highlightNegative />
                          </TableCell>
                          <TableCell className="text-right">
                            <MoneyCell
                              value={row.cumulativeVariance}
                              highlightNegative
                            />
                          </TableCell>
                          <TableCell>
                            {row.timelineStatus === 'FUTURE' ? (
                              <span className="text-xs text-slate-500">Chưa đến kỳ</span>
                            ) : (
                              <ScheduleStatusBadge status={row.scheduleStatus} />
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex max-w-[220px] flex-wrap gap-1">
                              {(row.timelineStatus === 'FUTURE' ? [] : row.bottlenecks).map((flag) => (
                                <BottleneckBadge key={flag} flag={flag} />
                              ))}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={savingPeriod === row.period}
                              onClick={() => handleSaveActualWork(row.period)}
                            >
                              Lưu TH
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent> : null}
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Timeline hợp đồng</CardTitle>
                <p className="text-sm text-slate-500">
                  {formatDate(data.timeline.startDate)} —{' '}
                  {formatDate(data.timeline.endDate)} ·{' '}
                  {data.timeline.periods.length} tháng theo thời hạn HĐ
                </p>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="rounded-md bg-slate-100 px-2 py-1">
                    Bắt đầu: {formatDate(data.timeline.startDate)}
                  </span>
                  {data.timeline.periods.map((period) => {
                    const row = data.rows.find((item) => item.period === period);
                    return (
                      <span
                        key={period}
                        className={cn(
                          'rounded-md px-2 py-1',
                          row?.timelineStatus === 'CURRENT' &&
                            'bg-sky-100 font-medium text-sky-900',
                          row?.timelineStatus === 'PAST' && 'bg-slate-100',
                          row?.timelineStatus === 'FUTURE' &&
                            'border border-dashed border-slate-200 bg-white',
                          row?.scheduleStatus === 'BEHIND' &&
                            row.timelineStatus !== 'FUTURE' &&
                            'ring-1 ring-red-200',
                        )}
                      >
                        {formatPeriod(period)}
                      </span>
                    );
                  })}
                  <span className="rounded-md bg-slate-100 px-2 py-1">
                    Kết thúc: {formatDate(data.timeline.endDate)}
                  </span>
                </div>

                <div className="border-t border-slate-100 pt-4">
                  <p className="mb-3 text-sm font-medium text-slate-800">
                    Biểu đồ theo thời hạn HĐ · Kế hoạch / Nghiệm thu / Thu tiền
                  </p>
                  <FinancialControlChart
                    rows={data.rows}
                    periods={data.timeline.periods}
                  />
                </div>
              </CardContent>
            </Card>

            <CollectionsSection contractId={contractId} onChanged={load} />

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Nghiệm thu</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-slate-600">
                <p>
                  Nghiệm thu được lấy từ module Nghiệm thu (chỉ trạng thái{' '}
                  <strong>Đã duyệt</strong> được tính vào báo cáo).
                </p>
                <Button asChild size="sm" variant="outline">
                  <Link href={`/contracts/${contractId}?tab=acceptances`}>
                    Quản lý nghiệm thu
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </>
        )}
      </QueryState>
    </div>
  );
}
