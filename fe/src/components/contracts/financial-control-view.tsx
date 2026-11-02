'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { financialControlApi } from '@/lib/api';
import {
  formatCurrencyVND,
  formatDate,
  formatPeriod,
  isNegativeDecimal,
} from '@/lib/format';
import type { FinancialControlResponse } from '@/lib/types';
import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { QueryState } from '@/components/shared/query-state';
import {
  BottleneckBadge,
  ScheduleStatusBadge,
} from '@/components/shared/status-badges';
import { FinancialControlChart } from '@/components/contracts/financial-control-chart';
import { ContractBatchTimelineStrip } from '@/components/contracts/contract-batch-timeline-strip';
import {
  BATCH_BAND_BG_CLASS,
  batchLabel,
  buildPeriodBatchDecorations,
  formatBatchDateRange,
} from '@/lib/plan-batch-period-map';
import { CollapsibleTableCard } from '@/components/shared/collapsible-table-card';
import { KeyValueTable } from '@/components/shared/key-value-table';
import { DashboardPieChart } from '@/components/dashboard/dashboard-charts';
import { Button } from '@/components/ui/button';
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
import {
  ContractKindProvider,
  contractFlowLabels,
  contractKindLabel,
  contractListHref,
} from '@/lib/contract-kind';
import { ContractContextBar } from '@/components/contracts/contract-context-bar';
import { ActualWorkPeriodDialog } from '@/components/contracts/actual-work-period-dialog';
import { WriteOnly } from '@/components/auth/auth-provider';

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

/**
 * Theo dõi HĐ theo tháng: kế hoạch / thực hiện / nghiệm thu / tiền và tiến độ.
 * Kế hoạch, nghiệm thu, thu–chi tiền được nhập ở các tab của trang chi tiết HĐ.
 */
export function FinancialControlView({ contractId }: { contractId: string }) {
  const [data, setData] = useState<FinancialControlResponse | null>(null);
  const flow = contractFlowLabels(data?.contract.kind ?? 'INVESTOR');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actualWorkDrafts, setActualWorkDrafts] = useState<
    Record<string, string>
  >({});
  const [actualWorkEdit, setActualWorkEdit] = useState<{
    period: string;
    monthlyFinancialId?: string | null;
    amount: string;
  } | null>(null);

  const batchDecorations = useMemo(() => {
    if (!data) return new Map();
    return buildPeriodBatchDecorations(
      data.timeline.periods,
      data.rows,
      data.contract.billingCycle,
    );
  }, [data]);

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
          <ContractKindProvider kind={data.contract.kind}>
            <Breadcrumbs
              items={[
                { label: 'Quản lý dự án' },
                {
                  label: contractKindLabel[flow.kind],
                  href: contractListHref(flow.kind),
                },
                {
                  label: data.contract.contractNo,
                  href: `/contracts/${contractId}`,
                },
                { label: 'Theo dõi theo tháng' },
              ]}
            />

            <ContractContextBar
              projectCode={data.contract.project?.code}
              projectName={
                data.contract.project?.name ?? data.contract.project?.code
              }
              projectId={data.contract.project?.id}
              contractNo={data.contract.contractNo}
              contractName={data.contract.name}
              className="-mx-1 mb-2 rounded-md px-1"
            />

            <ActualWorkPeriodDialog
              open={actualWorkEdit != null}
              onOpenChange={(open) => {
                if (!open) setActualWorkEdit(null);
              }}
              contractId={contractId}
              period={actualWorkEdit?.period ?? ''}
              monthlyFinancialId={actualWorkEdit?.monthlyFinancialId}
              initialAmount={actualWorkEdit?.amount ?? '0'}
              onSaved={load}
            />

            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <Button asChild variant="ghost" size="sm" className="-ml-2 mb-1">
                  <Link href={`/contracts/${contractId}`}>
                    <ArrowLeft className="h-4 w-4" />
                    Quay lại hợp đồng
                  </Link>
                </Button>
                <h2 className="font-serif text-2xl font-semibold">
                  Theo dõi theo tháng
                </h2>
                <p className="text-sm text-slate-500">
                  Kỳ hiện tại {formatPeriod(data.timeline.currentPeriod)} · HĐ{' '}
                  {formatDate(data.timeline.startDate)} —{' '}
                  {formatDate(data.timeline.endDate)}. Nhập kế hoạch / nghiệm
                  thu / {flow.cashFlowLower} ở trang chi tiết HĐ.
                </p>
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

            <CollapsibleTableCard
              title="Tổng quan tài chính"
              description={
                data.summary.overContractValue
                  ? 'Cảnh báo: đã nghiệm thu vượt giá trị hợp đồng.'
                  : isNegativeDecimal(data.summary.scheduleVariance)
                    ? `Chậm kế hoạch lũy kế ${formatCurrencyVND(data.summary.scheduleVariance.replace(/^-/, ''))} — cần đẩy nghiệm thu.`
                    : `${flow.outstanding} ${formatCurrencyVND(data.summary.outstandingCollection)}`
              }
              defaultOpen
            >
              <KeyValueTable
                compact
                showHeader={false}
                rows={[
                  {
                    label: 'KH NT đến kỳ hiện tại',
                    value: formatCurrencyVND(data.summary.plannedToDate ?? '0'),
                    hint: `KH tháng này ${formatCurrencyVND(data.summary.monthlyRequiredAcceptance ?? '0')}`,
                  },
                  {
                    label: 'Đã nộp HS đến kỳ',
                    value: formatCurrencyVND(data.summary.submittedToDate ?? '0'),
                    tone:
                      Number(data.summary.remainingPlanAfterPending ?? 0) === 0
                        ? 'success'
                        : 'warning',
                  },
                  {
                    label: 'Chờ nộp HS',
                    value: formatCurrencyVND(
                      data.summary.pendingSubmissionToDate ?? '0',
                    ),
                    tone:
                      Number(data.summary.pendingSubmissionToDate ?? 0) > 0
                        ? 'warning'
                        : undefined,
                  },
                  {
                    label: 'Thiếu so với KH',
                    value: formatCurrencyVND(
                      data.summary.remainingPlanAfterPending ?? '0',
                    ),
                    tone:
                      Number(data.summary.remainingPlanAfterPending ?? 0) > 0
                        ? 'danger'
                        : 'success',
                  },
                  {
                    label: 'Giá trị HĐ',
                    value: formatCurrencyVND(data.summary.contractValue),
                  },
                  {
                    label: 'Đã nghiệm thu',
                    value: formatCurrencyVND(data.summary.totalAccepted),
                  },
                  {
                    label: flow.cashedFull,
                    value: formatCurrencyVND(data.summary.totalCollected),
                  },
                  {
                    label: 'Tiến độ KH',
                    value: `${data.summary.scheduleRatePercent ?? '0'}%`,
                    hint: `Trạng thái: ${data.summary.scheduleStatus}`,
                  },
                ]}
              />
            </CollapsibleTableCard>

            <Card className="overflow-hidden">
              <CardHeader>
                <CardTitle className="text-base">
                  Theo dõi thực hiện &amp; tiến độ
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="w-full overflow-x-auto">
                  <Table className="min-w-[1400px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Kỳ</TableHead>
                        <TableHead className="text-right">Kế hoạch</TableHead>
                        <TableHead className="text-right">Thực hiện</TableHead>
                        <TableHead className="text-right">Nghiệm thu</TableHead>
                        <TableHead className="text-right">{flow.cashFlow}</TableHead>
                        <TableHead className="text-right">Lũy kế KH</TableHead>
                        <TableHead className="text-right">Lũy kế NT</TableHead>
                        <TableHead className="text-right">Lũy kế TT</TableHead>
                        <TableHead className="text-right">Còn NT</TableHead>
                        <TableHead className="text-right">Còn thu</TableHead>
                        <TableHead className="text-right">Lệch tháng</TableHead>
                        <TableHead className="text-right">Lệch lũy kế</TableHead>
                        <TableHead>Trạng thái</TableHead>
                        <TableHead>Cảnh báo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.rows.map((row) => {
                        const batch = batchDecorations.get(row.period);
                        return (
                        <TableRow
                          key={row.period}
                          className={cn(
                            batch &&
                              BATCH_BAND_BG_CLASS[
                                batch.bandIndex % BATCH_BAND_BG_CLASS.length
                              ],
                            !batch &&
                              row.timelineStatus === 'CURRENT' &&
                              'bg-sky-50/70',
                            !batch &&
                              row.timelineStatus === 'PAST' &&
                              'bg-white',
                          )}
                        >
                          <TableCell className="font-medium">
                            {row.periodLabel}
                            <div className="text-xs text-slate-500">
                              {formatPeriod(row.period)}
                            </div>
                            {batch ? (
                              <div className="mt-0.5 text-xs font-medium text-slate-700">
                                {batchLabel(batch.batchSequence)}
                                {formatBatchDateRange(
                                  batch.periodStartDate,
                                  batch.periodEndDate,
                                ) ? (
                                  <span className="block font-normal text-slate-500">
                                    {formatBatchDateRange(
                                      batch.periodStartDate,
                                      batch.periodEndDate,
                                    )}
                                  </span>
                                ) : null}
                              </div>
                            ) : null}
                          </TableCell>
                          <TableCell className="text-right">
                            <MoneyCell value={row.plannedAmount} />
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <MoneyCell value={row.actualWorkAmount} />
                              <WriteOnly>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs"
                                  onClick={() =>
                                    setActualWorkEdit({
                                      period: row.period,
                                      monthlyFinancialId: row.monthlyFinancialId,
                                      amount:
                                        actualWorkDrafts[row.period] ??
                                        row.actualWorkAmount ??
                                        '0',
                                    })
                                  }
                                >
                                  {Number(row.actualWorkAmount ?? 0) > 0
                                    ? 'Sửa'
                                    : 'Nhập'}
                                </Button>
                              </WriteOnly>
                            </div>
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
                        </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <CollapsibleTableCard
              title="Timeline hợp đồng"
              description={`${data.timeline.periods.length} kỳ · biểu đồ tròn + cột/đường`}
              defaultOpen={false}
            >
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="rounded-md bg-slate-100 px-2 py-1 font-medium">
                    Bắt đầu: {formatDate(data.timeline.startDate)}
                  </span>
                  <span className="rounded-md bg-slate-100 px-2 py-1 font-medium">
                    Kết thúc: {formatDate(data.timeline.endDate)}
                  </span>
                </div>
                <ContractBatchTimelineStrip
                  periods={data.timeline.periods}
                  points={data.rows}
                  billingCycle={data.contract.billingCycle}
                  timelineStatusByPeriod={
                    new Map(
                      data.rows.map((row) => [row.period, row.timelineStatus]),
                    )
                  }
                />

                <div className="grid gap-4 lg:grid-cols-2">
                  <div>
                    <p className="mb-2 text-sm font-semibold text-slate-900">
                      Nghiệm thu so với giá trị HĐ
                    </p>
                    <DashboardPieChart
                      data={[
                        {
                          key: 'ACCEPTED',
                          label: 'Đã nghiệm thu',
                          amount: data.summary.totalAccepted,
                        },
                        {
                          key: data.summary.overContractValue
                            ? 'NOT_ACCEPTED'
                            : 'REMAINING',
                          label: data.summary.overContractValue
                            ? 'Vượt HĐ'
                            : 'Chưa nghiệm thu',
                          amount: data.summary.overContractValue
                            ? String(
                                Math.max(
                                  Number(data.summary.totalAccepted) -
                                    Number(data.summary.contractValue),
                                  0,
                                ),
                              )
                            : data.summary.remainingAcceptance ===
                                'OVER_CONTRACT_VALUE'
                              ? '0'
                              : data.summary.remainingAcceptance,
                        },
                      ]}
                    />
                  </div>
                  <div>
                    <p className="mb-2 text-sm font-semibold text-slate-900">
                      {flow.cashRate}
                    </p>
                    <DashboardPieChart
                      data={[
                        {
                          key: 'COLLECTED',
                          label: flow.cashed,
                          amount: data.summary.totalCollected,
                        },
                        {
                          key: 'OUTSTANDING',
                          label: flow.outstanding,
                          amount: data.summary.outstandingCollection,
                        },
                      ]}
                    />
                  </div>
                </div>

                <FinancialControlChart
                  rows={data.rows}
                  periods={data.timeline.periods}
                  billingCycle={data.contract.billingCycle}
                />
              </div>
            </CollapsibleTableCard>
          </ContractKindProvider>
        )}
      </QueryState>
    </div>
  );
}
