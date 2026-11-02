'use client';

import Link from 'next/link';
import { formatCurrencyVND } from '@/lib/format';
import type { ProjectFinanceOverview } from '@/lib/types';
import { FinancialControlChart } from '@/components/contracts/financial-control-chart';
import { ContractStatusBadge } from '@/components/shared/status-badges';
import { CollapsibleSection } from '@/components/shared/collapsible-section';
import { KeyValueTable } from '@/components/shared/key-value-table';
import { CollapsibleTableCard } from '@/components/shared/collapsible-table-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const STATUS_COLORS: Record<string, string> = {
  COLLECTED: 'bg-blue-600',
  WAITING_PAYMENT: 'bg-teal-600',
  NOT_ACCEPTED: 'bg-amber-500',
  REMAINING_CONTRACT: 'bg-slate-400',
};

export function ProjectAcceptanceOverviewSection({
  overview,
}: {
  overview: ProjectFinanceOverview;
}) {
  const { summary, statusBreakdown, contracts } = overview;
  const acceptedRate = Number(summary.acceptanceRatePercent ?? 0);

  const totalBreakdown = statusBreakdown.reduce(
    (sum, slice) => sum + Number(slice.amount || 0),
    0,
  );

  return (
    <div className="space-y-4">
      <CollapsibleTableCard
        title="Tình trạng nghiệm thu dự án"
        description={`${summary.contractCount} hợp đồng · ${acceptedRate.toFixed(1)}% đã nghiệm thu`}
        defaultOpen
      >
          <KeyValueTable
            compact
            showHeader={false}
            rows={[
              {
                label: 'KH NT đến kỳ hiện tại',
                value: formatCurrencyVND(summary.plannedToDate ?? '0'),
                hint: summary.currentPeriod
                  ? `Kỳ ${summary.currentPeriod}`
                  : undefined,
              },
              {
                label: 'Đã nộp HS đến kỳ',
                value: formatCurrencyVND(summary.submittedToDate ?? '0'),
                hint: `Đã nộp / KH: ${formatCurrencyVND(summary.submittedToDate ?? '0')} / ${formatCurrencyVND(summary.plannedToDate ?? '0')}`,
                tone:
                  Number(summary.remainingPlanAfterPending ?? 0) === 0
                    ? 'success'
                    : 'warning',
              },
              {
                label: 'Đã lên NT, chờ nộp HS',
                value: formatCurrencyVND(summary.pendingSubmissionToDate ?? '0'),
                hint: 'Đã ghi nhận đợt NT nhưng chưa nộp hồ sơ',
                tone:
                  Number(summary.pendingSubmissionToDate ?? 0) > 0
                    ? 'warning'
                    : undefined,
              },
              {
                label: 'Chậm so với KH hiện tại',
                value: formatCurrencyVND(summary.remainingPlanAfterPending ?? '0'),
                hint:
                  Number(summary.remainingPlanAfterPending ?? 0) > 0
                    ? 'Phần KH lũy kế chưa có đợt NT nào bù vào'
                    : 'Đủ KH, gồm cả đợt đang chờ nộp HS',
                tone:
                  Number(summary.remainingPlanAfterPending ?? 0) > 0
                    ? 'danger'
                    : 'success',
              },
            ]}
          />

          {totalBreakdown > 0 ? (
            <div className="mt-4 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
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
              <KeyValueTable
                compact
                showHeader={false}
                rows={statusBreakdown.map((slice) => ({
                  label: slice.label,
                  value: formatCurrencyVND(slice.amount),
                }))}
              />
            </div>
          ) : null}
      </CollapsibleTableCard>

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
                <KeyValueTable
                  compact
                  showHeader={false}
                  rows={[
                    {
                      label: 'Giá trị HĐ',
                      value: formatCurrencyVND(contract.contractValue),
                    },
                    {
                      label: 'Đã nghiệm thu',
                      value: formatCurrencyVND(contract.summary.totalAccepted),
                      hint: `${contract.summary.acceptanceRatePercent}%`,
                    },
                    {
                      label: 'Chưa nghiệm thu',
                      value:
                        contract.summary.overContractValue ||
                        contract.summary.remainingAcceptance ===
                          'OVER_CONTRACT_VALUE'
                          ? 'Vượt giá trị HĐ'
                          : formatCurrencyVND(
                              contract.summary.remainingAcceptance,
                            ),
                    },
                    {
                      label: 'CĐT còn nợ',
                      value: formatCurrencyVND(
                        contract.summary.outstandingCollection,
                      ),
                      hint: `Thu ${contract.summary.collectionRatePercent}%`,
                    },
                  ]}
                />

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

                <CollapsibleSection
                  title="Biểu đồ theo HĐ · chọn nhiều loại cùng lúc"
                  description="Thu gọn để xem nhanh tóm tắt; mở khi cần phân tích chi tiết"
                  defaultOpen={false}
                >
                  <FinancialControlChart
                    compact
                    rows={contract.rows}
                    periods={contract.timeline.periods}
                  />
                </CollapsibleSection>
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
