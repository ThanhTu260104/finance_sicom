'use client';

import Link from 'next/link';
import type { ComparisonRow } from './comparison-chart';
import type { DashboardCumulativeTrendPoint } from '@/lib/types';
import { formatCurrencyVND, formatPeriod, formatPercentDisplay } from '@/lib/format';
import { parseChartAmount, trendPointFullLabel } from './chart-utils';
import { compareDecimalStrings } from '@/lib/format';

function gapSeverity(gap: string) {
  return parseChartAmount(gap);
}

export function AtRiskProjectsPanel({ rows }: { rows: ComparisonRow[] }) {
  const atRisk = [...rows]
    .filter((r) => compareDecimalStrings(r.acceptanceGap, '0') > 0)
    .sort((a, b) => gapSeverity(b.acceptanceGap) - gapSeverity(a.acceptanceGap))
    .slice(0, 8);

  if (atRisk.length === 0) {
    return (
      <p className="text-sm text-slate-600">
        Không có dự án lệch kế hoạch nghiệm thu (chênh lệch ≤ 0).
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {atRisk.map((p) => (
        <li
          key={p.id}
          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-sm"
        >
          <div>
            <Link
              href={p.href ?? '#'}
              className="font-medium text-slate-900 hover:underline"
            >
              {p.label}
            </Link>
            <p className="text-xs text-slate-600">
              Chênh lệch NT: {formatCurrencyVND(p.acceptanceGap)} · NT{' '}
              {formatPercentDisplay(p.acceptancePercent)} · Thu{' '}
              {formatPercentDisplay(p.collectionPercent)}
            </p>
          </div>
          <span className="tabular-nums font-semibold text-amber-900">
            {formatCurrencyVND(p.acceptanceGap)}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function AtRiskContractsPanel({ rows }: { rows: ComparisonRow[] }) {
  return <AtRiskProjectsPanel rows={rows} />;
}

/** Tháng / đợt NT thấp hơn KH (gap dương), chỉ tính kỳ đã tới. */
export function AtRiskMonthsPanel({
  rows,
  currentPeriod,
}: {
  rows: DashboardCumulativeTrendPoint[];
  /** Bỏ qua kỳ / đợt chưa tới (period > currentPeriod) */
  currentPeriod?: string | null;
}) {
  const byBatch = rows.some((r) => r.label);
  const unit = byBatch ? 'đợt' : 'tháng';
  const atRisk = [...rows]
    .filter((r) => {
      if (currentPeriod && r.period > currentPeriod) return false;
      const gap = r.acceptanceGapPeriod ?? r.acceptanceGap;
      return compareDecimalStrings(gap, '0') > 0;
    })
    .sort((a, b) => {
      const ga = a.acceptanceGapPeriod ?? a.acceptanceGap;
      const gb = b.acceptanceGapPeriod ?? b.acceptanceGap;
      return gapSeverity(gb) - gapSeverity(ga);
    })
    .slice(0, 12);

  if (atRisk.length === 0) {
    return (
      <p className="text-sm text-slate-600">
        Không có {unit} nào nghiệm thu thấp hơn kế hoạch trong dữ liệu hiện tại.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {atRisk.map((m) => {
        const gap = m.acceptanceGapPeriod ?? m.acceptanceGap;
        return (
          <li
            key={m.period}
            className="rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-sm"
          >
            <p className="font-medium text-slate-900">
              {m.label ? trendPointFullLabel(m) : formatPeriod(m.period)}
            </p>
            <p className="text-xs text-slate-700">
              KH: {formatCurrencyVND(m.plannedAcceptance)} · NT:{' '}
              {formatCurrencyVND(m.actualAcceptance)} · GAP:{' '}
              {formatCurrencyVND(gap)} · Thu:{' '}
              {formatCurrencyVND(m.actualCollection)} · % NT {unit}:{' '}
              {formatPercentDisplay(m.acceptanceProgressPeriod)}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
