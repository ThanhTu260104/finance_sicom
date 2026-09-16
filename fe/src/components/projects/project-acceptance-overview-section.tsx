'use client';

import Link from 'next/link';
import { formatCurrencyVND } from '@/lib/format';
import type { ProjectFinanceOverview } from '@/lib/types';
import { FinancialControlChart } from '@/components/contracts/financial-control-chart';
import {
  ContractStatusBadge,
} from '@/components/shared/status-badges';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const STATUS_COLORS: Record<string, string> = {
  COLLECTED: 'bg-blue-600',
  WAITING_PAYMENT: 'bg-teal-600',
  NOT_ACCEPTED: 'bg-amber-500',
  REMAINING_CONTRACT: 'bg-slate-400',
};

function SummaryMetric({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: 'danger' | 'success' | 'warning';
}) {
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
      <p className="mt-1 text-lg font-semibold text-slate-900">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

export function ProjectAcceptanceOverviewSection({
  overview,
}: {
  overview: ProjectFinanceOverview;
}) {
  const { summary, statusBreakdown, contracts } = overview;
  const acceptedRate = Number(summary.acceptanceRatePercent ?? 0);
  const over = summary.overContractValue;

  const totalBreakdown = statusBreakdown.reduce(
    (sum, slice) => sum + Number(slice.amount || 0),
    0,
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Tình trạng nghiệm thu dự án</CardTitle>
          <p className="text-sm text-slate-600">
            Tổng hợp {summary.contractCount} hợp đồng ·{' '}
            {acceptedRate.toFixed(1)}% giá trị đã nghiệm thu
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryMetric
              label="KH NT đến kỳ hiện tại"
              value={formatCurrencyVND(summary.plannedToDate ?? '0')}
              hint={summary.currentPeriod ? `Kỳ ${summary.currentPeriod}` : undefined}
            />
            <SummaryMetric
              label="Đã nộp HS đến kỳ"
              value={formatCurrencyVND(summary.submittedToDate ?? '0')}
              hint={`Đã nộp / KH: ${formatCurrencyVND(summary.submittedToDate ?? '0')} / ${formatCurrencyVND(summary.plannedToDate ?? '0')}`}
              tone={
                Number(summary.remainingPlanAfterPending ?? 0) === 0
                  ? 'success'
                  : 'warning'
              }
            />
            <SummaryMetric
              label="Đã lên NT, chờ nộp HS"
              value={formatCurrencyVND(summary.pendingSubmissionToDate ?? '0')}
              hint="Đã ghi nhận đợt NT nhưng chưa nộp hồ sơ"
              tone={Number(summary.pendingSubmissionToDate ?? 0) > 0 ? 'warning' : undefined}
            />
            <SummaryMetric
              label="Chậm so với KH hiện tại"
              value={formatCurrencyVND(summary.remainingPlanAfterPending ?? '0')}
              hint={
                Number(summary.remainingPlanAfterPending ?? 0) > 0
                  ? 'Phần KH lũy kế chưa có đợt NT nào bù vào'
                  : 'Đủ KH, gồm cả đợt đang chờ nộp HS'
              }
              tone={Number(summary.remainingPlanAfterPending ?? 0) > 0 ? 'danger' : 'success'}
            />
          </div>

          {totalBreakdown > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Phân bổ trạng thái
              </p>
              <div className="flex h-3 overflow-hidden rounded-full bg-slate-100">
                {statusBreakdown.map((slice) => {
                  const amount = Number(slice.amount || 0);
                  if (amount <= 0) return null;
                  const width = (amount / totalBreakdown) * 100;
                  return (
                    <div
                      key={slice.key}
                      className={cn(
                        'h-full',
                        STATUS_COLORS[slice.key] ?? 'bg-slate-300',
                      )}
                      style={{ width: `${width}%` }}
                      title={`${slice.label}: ${formatCurrencyVND(slice.amount)}`}
                    />
                  );
                })}
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {statusBreakdown.map((slice) => (
                  <div
                    key={slice.key}
                    className="flex items-center gap-2 text-sm text-slate-700"
                  >
                    <span
                      className={cn(
                        'h-2.5 w-2.5 shrink-0 rounded-full',
                        STATUS_COLORS[slice.key] ?? 'bg-slate-300',
                      )}
                    />
                    <span className="min-w-0 flex-1 truncate">{slice.label}</span>
                    <span className="shrink-0 font-medium">
                      {formatCurrencyVND(slice.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {contracts.length === 0 ? (
        <Card>
          <CardContent className="py-6">
            <p className="text-sm text-slate-500">
              Chưa có hợp đồng để hiển thị nghiệm thu.
            </p>
          </CardContent>
        </Card>
      ) : (
        contracts.map((contract) => {
          const rate = Number(contract.summary.acceptanceRatePercent ?? 0);
          return (
            <Card key={contract.contractId}>
              <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm text-slate-500">{contract.contractNo}</p>
                  <CardTitle className="text-base">{contract.name}</CardTitle>
                  <div className="mt-2">
                    <ContractStatusBadge status={contract.status} />
                  </div>
                </div>
                <Button asChild size="sm" variant="outline">
                  <Link href={`/contracts/${contract.contractId}`}>
                    Chi tiết HĐ
                  </Link>
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <SummaryMetric
                    label="Giá trị HĐ"
                    value={formatCurrencyVND(contract.contractValue)}
                  />
                  <SummaryMetric
                    label="Đã nghiệm thu"
                    value={formatCurrencyVND(contract.summary.totalAccepted)}
                    hint={`${contract.summary.acceptanceRatePercent}%`}
                  />
                  <SummaryMetric
                    label="Chưa nghiệm thu"
                    value={
                      contract.summary.overContractValue ||
                      contract.summary.remainingAcceptance ===
                        'OVER_CONTRACT_VALUE'
                        ? 'Vượt giá trị HĐ'
                        : formatCurrencyVND(
                            contract.summary.remainingAcceptance,
                          )
                    }
                  />
                  <SummaryMetric
                    label="CĐT còn nợ"
                    value={formatCurrencyVND(
                      contract.summary.outstandingCollection,
                    )}
                    hint={`Thu ${contract.summary.collectionRatePercent}%`}
                  />
                </div>

                <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={cn(
                      'h-full rounded-full',
                      contract.summary.overContractValue
                        ? 'bg-red-500'
                        : 'bg-teal-600',
                    )}
                    style={{ width: `${Math.min(Math.max(rate, 0), 100)}%` }}
                  />
                </div>

                <div className="rounded-lg border border-slate-200 p-3">
                  <p className="mb-2 text-sm font-medium text-slate-800">
                    Biểu đồ theo HĐ · chọn nhiều loại cùng lúc
                  </p>
                  <FinancialControlChart
                    compact
                    rows={contract.rows}
                    periods={contract.timeline.periods}
                  />
                </div>
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
