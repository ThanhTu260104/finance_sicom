'use client';

import Link from 'next/link';
import type { ProjectDashboardResponse } from '@/lib/types';
import { formatCurrencyVND, formatDate } from '@/lib/format';
import { CHART_BLUE } from '@/lib/chart-colors';

function parseMs(iso: string | null | undefined) {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : null;
}

/** Gantt một dự án — các hàng là hợp đồng. */
export function ContractGanttChart({
  timeline,
  asOf,
}: {
  timeline: ProjectDashboardResponse['timeline'];
  asOf: string;
}) {
  if (timeline.length === 0) {
    return <p className="text-sm text-slate-500">Chưa có hợp đồng.</p>;
  }

  let min = Infinity;
  let max = -Infinity;
  for (const t of timeline) {
    const s = parseMs(t.startDate);
    const e = parseMs(t.endDate);
    if (s != null) min = Math.min(min, s);
    if (e != null) max = Math.max(max, e);
  }
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) {
    const now = Date.now();
    min = now - 86400000 * 90;
    max = now + 86400000 * 90;
  }
  const pad = (max - min) * 0.04;
  min -= pad;
  max += pad;

  const asOfMs = parseMs(asOf) ?? Date.now();
  const labelW = 240;
  const chartW = 620;
  const rowH = 36;
  const padTop = 32;
  const height = padTop + timeline.length * rowH + 24;
  const chartLeft = labelW + 16;

  const xFor = (ms: number) =>
    chartLeft + ((ms - min) / (max - min)) * chartW;

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white p-4">
      <svg
        viewBox={`0 0 ${labelW + chartW + 40} ${height}`}
        className="min-w-[880px] w-full"
      >
        <line
          x1={xFor(asOfMs)}
          x2={xFor(asOfMs)}
          y1={8}
          y2={height - 8}
          stroke="#0f172a"
          strokeDasharray="4 3"
          strokeWidth={1}
        />
        {timeline.map((t, i) => {
          const y = padTop + i * rowH;
          const s = parseMs(t.startDate);
          const e = parseMs(t.endDate);
          const mid = y + rowH / 2;
          return (
            <g key={t.contractId}>
              <foreignObject x={4} y={y + 8} width={labelW - 8} height={24}>
                <Link
                  href={`/contracts/${t.contractId}/dashboard`}
                  className="text-[11px] font-medium text-slate-900 hover:underline"
                >
                  {t.contractNo} — {t.name}
                </Link>
              </foreignObject>
              {s != null && e != null && e > s ? (
                <rect
                  x={xFor(s)}
                  y={mid - 8}
                  width={Math.max(xFor(e) - xFor(s), 2)}
                  height={16}
                  fill={CHART_BLUE}
                  rx={3}
                >
                  <title>
                    {[
                      `${formatDate(t.startDate)} → ${formatDate(t.endDate)}`,
                      `Giá trị: ${formatCurrencyVND(t.contractValue)}`,
                      `NT: ${formatCurrencyVND(t.actualAcceptanceToDate)}`,
                    ].join('\n')}
                  </title>
                </rect>
              ) : null}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
