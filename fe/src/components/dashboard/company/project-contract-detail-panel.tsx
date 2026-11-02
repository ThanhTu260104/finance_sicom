'use client';

import Link from 'next/link';
import type { ProjectDashboardContractRow } from '@/lib/types';
import { formatContractDurationLine } from '@/lib/contract-duration';
import {
  formatCurrencyVND,
  formatDate,
  formatPercentDisplay,
} from '@/lib/format';
import { ContractStatusBadge } from '@/components/shared/status-badges';
import { Button } from '@/components/ui/button';
import { ContractDashboardChartsLoader } from '@/components/dashboard/contract/contract-dashboard-charts-loader';
import { HorizontalMetricStrip } from '@/components/dashboard/financial-chart/chart-context-bar';
import type { ChartContextItem } from '@/components/dashboard/financial-chart/chart-context-bar';
import { formatScheduleHintDisplay } from '@/lib/acceptance-rounds-display';

function contractOverviewStrip(
  contract: ProjectDashboardContractRow,
): ChartContextItem[] {
  const total = contract.scheduleTotalRounds ?? 0;
  const submitted =
    contract.scheduleSubmittedRounds ?? contract.scheduleApprovedRounds ?? 0;
  const collected = contract.scheduleCompletedRounds ?? 0;

  const items: ChartContextItem[] = [
    {
      label: 'Đã nghiệm thu',
      value:
        total > 0 ? `${submitted}/${total} đợt` : formatScheduleHintDisplay(contract.scheduleHint),
    },
  ];

  if (total > 0 && collected !== submitted) {
    items.push({
      label: 'Đã thu tiền',
      value: `${collected}/${total} đợt`,
    });
  }

  items.push(
    {
      label: 'Bắt đầu',
      value: contract.startDate ? formatDate(contract.startDate) : '—',
    },
    {
      label: 'Kết thúc',
      value: contract.endDate ? formatDate(contract.endDate) : '—',
    },
    {
      label: 'Thời hạn',
      value: formatContractDurationLine(contract),
    },
  );

  if (contract.timeProgressPercent != null) {
    items.push({
      label: 'Tiến độ thời gian',
      value: formatPercentDisplay(contract.timeProgressPercent),
    });
  }

  return items;
}

function contractFinanceStrip(
  contract: ProjectDashboardContractRow,
): ChartContextItem[] {
  return [
    {
      label: 'Giá trị HĐ',
      value: formatCurrencyVND(contract.contractValue),
    },
    {
      label: 'KH NT đến hiện tại',
      value: formatCurrencyVND(contract.plannedAcceptanceToDate),
    },
    {
      label: 'Đã NT',
      value: formatCurrencyVND(contract.actualAcceptanceToDate),
    },
    {
      label: 'Chênh NT',
      value: formatCurrencyVND(contract.acceptanceGap),
    },
    {
      label: 'Đã thu',
      value: formatCurrencyVND(contract.actualCollectionToDate),
    },
    {
      label: 'Còn thu',
      value: formatCurrencyVND(contract.outstandingCollection),
    },
    {
      label: '% NT / thu',
      value: `${formatPercentDisplay(contract.acceptancePercent)} / ${formatPercentDisplay(contract.collectionPercent)}`,
    },
  ];
}

export function ProjectContractDetailPanel({
  contract,
  dashboardReturnUrl,
}: {
  contract: ProjectDashboardContractRow;
  /** Quay lại dashboard công ty đúng dự án/HĐ đang xem */
  dashboardReturnUrl?: string;
}) {
  const contractDashboardHref = dashboardReturnUrl
    ? `/contracts/${contract.contractId}/dashboard?returnTo=${encodeURIComponent(dashboardReturnUrl)}`
    : `/contracts/${contract.contractId}/dashboard`;
  const total = contract.scheduleTotalRounds ?? 0;
  const hint =
    total > 0 && contract.scheduleHint
      ? formatScheduleHintDisplay(contract.scheduleHint)
      : null;

  return (
    <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate font-mono text-xs font-bold text-slate-900">
            {contract.contractNo}
            <span className="ml-2 font-sans font-medium text-slate-700">
              {contract.name}
            </span>
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <ContractStatusBadge status={contract.status} />
            {contract.customerName ? (
              <span className="text-[11px] text-slate-500">
                {contract.customerName}
              </span>
            ) : null}
          </div>
        </div>
        <Button asChild variant="outline" size="sm" className="h-8 text-xs">
          <Link href={contractDashboardHref}>Dashboard HĐ</Link>
        </Button>
      </div>

      <HorizontalMetricStrip items={contractOverviewStrip(contract)} />
      {hint ? (
        <p className="px-1 text-[11px] text-slate-600">{hint}</p>
      ) : null}
      <HorizontalMetricStrip items={contractFinanceStrip(contract)} />

      {(contract.scheduleLateRounds > 0 ||
        contract.schedulePendingDocRounds > 0) && (
        <p className="px-1 text-[11px] text-amber-800">
          {contract.scheduleLateRounds > 0
            ? `${contract.scheduleLateRounds} đợt trễ. `
            : ''}
          {contract.schedulePendingDocRounds > 0
            ? `${contract.schedulePendingDocRounds} đợt chờ hồ sơ.`
            : ''}
        </p>
      )}

      <section className="space-y-2 border-t border-slate-100 pt-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Biểu đồ
        </h3>
        <ContractDashboardChartsLoader
          contractId={contract.contractId}
          variant="embedded"
        />
      </section>
    </div>
  );
}
