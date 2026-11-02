'use client';

import Link from 'next/link';
import type { DashboardByProjectRow } from '@/lib/types';
import { formatCurrencyVND, formatDate } from '@/lib/format';
import { HorizontalPeriodBar } from '@/components/dashboard/shared/horizontal-period-bar';

export function ProjectTimelineSection({
  projects,
  asOf,
}: {
  projects: DashboardByProjectRow[];
  asOf: string;
}) {
  if (projects.length === 0) {
    return <p className="text-sm text-slate-500">Chưa có dự án phù hợp bộ lọc.</p>;
  }

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      {projects.map((p) => (
        <div
          key={p.projectId}
          className="rounded-lg border border-slate-100 bg-slate-50/50 p-3"
          title={tooltip(p)}
        >
          <Link
            href={`/projects/${p.projectId}/dashboard`}
            className="font-medium text-slate-900 hover:underline"
          >
            {p.projectCode} — {p.projectName}
          </Link>
          <p className="text-xs text-slate-600">
            {p.customerName ?? '—'} · {p.contractCount} hợp đồng ·{' '}
            {formatCurrencyVND(p.contractValue)}
          </p>
          <HorizontalPeriodBar
            className="mt-2"
            startDate={p.startDate}
            endDate={p.endDate}
            asOf={asOf}
            markerLabel="HÔM NAY"
          />
          <p className="mt-1 text-xs text-slate-500">
            {formatDate(p.startDate)} → {formatDate(p.endDate)} · NT{' '}
            {formatCurrencyVND(p.actualAcceptanceToDate)} · Thu{' '}
            {formatCurrencyVND(p.actualCollectionToDate)}
          </p>
        </div>
      ))}
    </div>
  );
}

function tooltip(p: DashboardByProjectRow) {
  return [
    p.projectName,
    `Giá trị HĐ: ${formatCurrencyVND(p.contractValue)}`,
    `${formatDate(p.startDate)} → ${formatDate(p.endDate)}`,
    `KH NT: ${formatCurrencyVND(p.plannedAcceptanceToDate)}`,
    `NT thực tế: ${formatCurrencyVND(p.actualAcceptanceToDate)}`,
    `Thu: ${formatCurrencyVND(p.actualCollectionToDate)}`,
  ].join('\n');
}
