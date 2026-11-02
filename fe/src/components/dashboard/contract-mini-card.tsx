'use client';

import Link from 'next/link';
import type { DashboardContractRow } from '@/lib/types';
import {
  formatContractDurationLine,
  formatContractPeriodRange,
} from '@/lib/contract-duration';
import { formatCurrencyVND } from '@/lib/format';
import { DashboardPieChart } from '@/components/dashboard/dashboard-charts';
import { CumulativeProgressDiagram } from '@/components/dashboard/cumulative-progress-diagram';
import { ContractStatusBadge } from '@/components/shared/status-badges';
import { CollapsibleTableCard } from '@/components/shared/collapsible-table-card';

export function ContractMiniCard({
  contract,
  showProject,
  currentPeriod,
}: {
  contract: DashboardContractRow;
  showProject?: boolean;
  currentPeriod?: string;
}) {
  const pie = [
    {
      key: 'ACCEPTED',
      label: 'Đã nghiệm thu',
      amount: contract.totalAccepted,
    },
    {
      key: 'REMAINING',
      label: 'Chưa NT trên HĐ',
      amount: contract.remainingAcceptance,
    },
  ];

  const durationLine = formatContractDurationLine(contract);
  const contractPeriod = formatContractPeriodRange(contract);

  return (
    <CollapsibleTableCard
      title={contract.contractNo}
      description={contract.name}
      defaultOpen={false}
    >
      <div className="space-y-3 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <ContractStatusBadge status={contract.status} />
          {showProject ? (
            <span className="text-xs text-slate-500">
              {contract.projectCode} — {contract.projectName}
            </span>
          ) : null}
        </div>
        <p className="text-xs font-medium text-slate-600">{durationLine}</p>
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-center">
          <p className="text-xl font-bold tracking-tight text-slate-900">
            {contract.scheduleHint}
          </p>
          {contractPeriod ? (
            <p className="mt-1.5 text-sm font-medium text-slate-700">
              {contractPeriod}
            </p>
          ) : null}
          {contract.scheduleTotalRounds > 0 ? (
            <p className="mt-1 text-xs text-slate-500">
              Hoàn thành NT {contract.acceptancePercent}% giá trị HĐ · Thu{' '}
              {contract.collectionPercent}% trên đã NT
            </p>
          ) : null}
        </div>
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5">
          <dt className="text-slate-500">Giá trị HĐ</dt>
          <dd className="text-right font-semibold text-slate-900">
            {formatCurrencyVND(contract.contractValue)}
          </dd>
          <dt className="text-slate-500">Đã nghiệm thu</dt>
          <dd className="text-right font-semibold">
            {formatCurrencyVND(contract.totalAccepted)}
          </dd>
          <dt className="text-slate-500">Đã thu tiền</dt>
          <dd className="text-right font-semibold">
            {formatCurrencyVND(contract.totalCollected)}
          </dd>
        </dl>
        <CumulativeProgressDiagram
          currentPeriod={currentPeriod}
          plannedToDate={contract.plannedToDate ?? '0'}
          acceptedAmount={contract.totalAccepted}
          collectedAmount={contract.totalCollected}
          contractValue={contract.contractValue}
        />
        <DashboardPieChart data={pie} />
        <Link
          href={`/contracts/${contract.contractId}`}
          className="inline-block text-xs font-medium text-slate-700 underline-offset-2 hover:underline"
        >
          Xem hợp đồng
        </Link>
      </div>
    </CollapsibleTableCard>
  );
}
