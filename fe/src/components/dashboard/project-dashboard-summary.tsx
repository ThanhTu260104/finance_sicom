'use client';

import Link from 'next/link';
import type {
  DashboardContractRow,
  DashboardProjectRow,
  DashboardProjectScope,
} from '@/lib/types';
import { formatCurrencyVND } from '@/lib/format';
import { DashboardPieChart } from '@/components/dashboard/dashboard-charts';
import { CumulativeProgressDiagram } from '@/components/dashboard/cumulative-progress-diagram';

export function ProjectDashboardSummary({
  project,
  scope,
  contracts,
  currentPeriod,
}: {
  project: DashboardProjectRow;
  scope?: DashboardProjectScope;
  contracts: DashboardContractRow[];
  currentPeriod?: string;
}) {
  const totalRounds = contracts.reduce(
    (sum, c) => sum + c.scheduleTotalRounds,
    0,
  );
  const completedRounds = contracts.reduce(
    (sum, c) => sum + c.scheduleCompletedRounds,
    0,
  );
  const remainingRounds = Math.max(totalRounds - completedRounds, 0);
  const pendingDocRounds = contracts.reduce(
    (sum, c) => sum + (c.schedulePendingDocRounds ?? 0),
    0,
  );
  const lateRounds = contracts.reduce(
    (sum, c) => sum + (c.scheduleLateRounds ?? 0),
    0,
  );

  const customerName =
    contracts.find((c) => c.customerName)?.customerName ?? null;

  const scheduleHint =
    totalRounds > 0
      ? `Nghiệm thu ${completedRounds}/${totalRounds} đợt (đã thu tiền, cả dự án) · còn ${remainingRounds} đợt${
          lateRounds > 0 ? ` · ${lateRounds} trễ kế hoạch` : ''
        }${
          pendingDocRounds > 0
            ? ` · ${pendingDocRounds} đợt chưa nộp HS`
            : ''
        }`
      : contracts.length > 0
        ? 'Chưa đủ thời hạn/chu kỳ hoặc đợt NT trên các HĐ để tính tổng lần NT'
        : 'Chưa có hợp đồng';

  const pie = scope?.statusBreakdown?.length
    ? scope.statusBreakdown
    : [
        {
          key: 'ACCEPTED',
          label: 'Đã nghiệm thu',
          amount: project.accepted,
        },
        {
          key: 'REMAINING',
          label: 'Chưa NT trên HĐ',
          amount: project.remainingAcceptance,
        },
      ];

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-lg font-semibold text-slate-900">
            {project.projectCode} — {project.projectName}
          </p>
          {customerName ? (
            <p className="mt-0.5 text-sm text-slate-600">CĐT: {customerName}</p>
          ) : null}
          <p className="mt-1 text-xs text-slate-500">
            {contracts.length} hợp đồng · NT {project.acceptanceRatePercent}%
            giá trị HĐ
          </p>
        </div>
        <Link
          href={`/projects/${project.projectId}`}
          className="text-sm font-medium text-slate-700 underline-offset-2 hover:underline"
        >
          Xem dự án
        </Link>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white px-4 py-4 text-center">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Tổng hợp nghiệm thu theo đợt
        </p>
        <p className="mt-2 text-xl font-bold tracking-tight text-slate-900">
          {scheduleHint}
        </p>
      </div>

      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <dt className="text-xs text-slate-500">Tổng giá trị HĐ</dt>
          <dd className="mt-1 font-semibold text-slate-900">
            {formatCurrencyVND(project.contractValue)}
          </dd>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <dt className="text-xs text-slate-500">Đã nghiệm thu</dt>
          <dd className="mt-1 font-semibold">
            {formatCurrencyVND(project.accepted)}
          </dd>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <dt className="text-xs text-slate-500">Đã thu tiền</dt>
          <dd className="mt-1 font-semibold">
            {formatCurrencyVND(project.collected)}
          </dd>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <dt className="text-xs text-slate-500">Chưa thu / chờ nộp HS</dt>
          <dd className="mt-1 text-sm font-semibold">
            {formatCurrencyVND(project.outstandingCollection)}
            {comparePending(project.pendingSubmission) ? (
              <span className="mt-0.5 block text-xs font-normal text-amber-800">
                Chờ nộp HS: {formatCurrencyVND(project.pendingSubmission)}
              </span>
            ) : null}
          </dd>
        </div>
      </dl>

      <CumulativeProgressDiagram
        currentPeriod={currentPeriod}
        plannedToDate={project.planned}
        acceptedAmount={project.accepted}
        collectedAmount={project.collected}
        contractValue={project.contractValue}
      />

      <DashboardPieChart data={pie} />
    </div>
  );
}

function comparePending(value: string) {
  try {
    return BigInt(value.split('.')[0] || '0') > BigInt(0);
  } catch {
    return false;
  }
}
