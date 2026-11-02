'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type {
  DashboardByProjectRow,
  DashboardTimelineItem,
} from '@/lib/types';
import { formatCurrencyVND, formatDate } from '@/lib/format';
import { CHART_BLUE, CHART_SLATE } from '@/lib/chart-colors';

function parseMs(iso: string | null | undefined) {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : null;
}

function rangeFromRows(
  projects: DashboardByProjectRow[],
  contracts: DashboardTimelineItem[],
) {
  let min = Infinity;
  let max = -Infinity;
  for (const p of projects) {
    const s = parseMs(p.startDate);
    const e = parseMs(p.endDate);
    if (s != null) min = Math.min(min, s);
    if (e != null) max = Math.max(max, e);
  }
  for (const c of contracts) {
    const s = parseMs(c.startDate);
    const e = parseMs(c.endDate);
    if (s != null) min = Math.min(min, s);
    if (e != null) max = Math.max(max, e);
  }
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) {
    const now = Date.now();
    return { min: now - 86400000 * 180, max: now + 86400000 * 180 };
  }
  const pad = (max - min) * 0.04;
  return { min: min - pad, max: max + pad };
}

function xFor(ms: number, min: number, max: number, chartLeft: number, chartW: number) {
  const t = (ms - min) / (max - min);
  return chartLeft + t * chartW;
}

export function ProjectContractGanttChart({
  projects,
  contracts,
  asOf,
  loading,
}: {
  projects: DashboardByProjectRow[];
  contracts: DashboardTimelineItem[];
  asOf: string;
  loading?: boolean;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  const byProject = useMemo(() => {
    const map = new Map<string, DashboardTimelineItem[]>();
    for (const c of contracts) {
      const list = map.get(c.projectId) ?? [];
      list.push(c);
      map.set(c.projectId, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => (a.contractNo ?? '').localeCompare(b.contractNo ?? ''));
    }
    return map;
  }, [contracts]);

  const sortedProjects = useMemo(
    () => [...projects].sort((a, b) => a.projectCode.localeCompare(b.projectCode)),
    [projects],
  );

  const { min, max } = useMemo(
    () => rangeFromRows(projects, contracts),
    [projects, contracts],
  );

  const asOfMs = parseMs(asOf) ?? Date.now();

  const rows = useMemo(() => {
    const out: Array<
      | { kind: 'project'; project: DashboardByProjectRow }
      | { kind: 'contract'; contract: DashboardTimelineItem; projectId: string }
    > = [];
    for (const p of sortedProjects) {
      out.push({ kind: 'project', project: p });
      if (expanded.has(p.projectId)) {
        for (const c of byProject.get(p.projectId) ?? []) {
          out.push({ kind: 'contract', contract: c, projectId: p.projectId });
        }
      }
    }
    return out;
  }, [sortedProjects, expanded, byProject]);

  const labelW = 260;
  const chartW = 640;
  const rowH = 34;
  const padTop = 36;
  const padBottom = 28;
  const height = padTop + rows.length * rowH + padBottom;
  const width = labelW + chartW + 48;
  const chartLeft = labelW + 16;
  const todayX = xFor(asOfMs, min, max, chartLeft, chartW);

  const toggle = (projectId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
  };

  if (loading) {
    return <p className="text-sm text-slate-500">Đang tải timeline…</p>;
  }
  if (sortedProjects.length === 0) {
    return <p className="text-sm text-slate-500">Chưa có dự án phù hợp bộ lọc.</p>;
  }

  return (
    <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs text-slate-600">
        Bấm dự án để xổ danh sách hợp đồng trên biểu đồ Gantt. Đường đứt nét = thời điểm hiện tại.
      </p>
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="min-w-[900px] w-full"
          role="img"
          aria-label="Timeline dự án và hợp đồng"
        >
          <text
            x={chartLeft}
            y={16}
            className="fill-slate-500 text-[10px]"
          >
            {formatDate(new Date(min).toISOString())}
          </text>
          <text
            x={chartLeft + chartW}
            y={16}
            textAnchor="end"
            className="fill-slate-500 text-[10px]"
          >
            {formatDate(new Date(max).toISOString())}
          </text>

          <line
            x1={todayX}
            x2={todayX}
            y1={padTop - 8}
            y2={height - padBottom}
            stroke="#0f172a"
            strokeWidth={1}
            strokeDasharray="4 3"
          />
          <text
            x={todayX + 4}
            y={padTop - 10}
            className="fill-slate-800 text-[9px] font-medium"
          >
            Hôm nay
          </text>

          {rows.map((row, i) => {
            const y = padTop + i * rowH;
            const midY = y + rowH / 2;

            if (row.kind === 'project') {
              const p = row.project;
              const open = expanded.has(p.projectId);
              const s = parseMs(p.startDate);
              const e = parseMs(p.endDate);
              const barH = 14;
              return (
                <g key={`p-${p.projectId}`}>
                  <rect
                    x={0}
                    y={y}
                    width={width}
                    height={rowH}
                    fill={i % 2 === 0 ? '#f8fafc' : '#ffffff'}
                  />
                  <foreignObject x={4} y={y + 4} width={labelW - 8} height={rowH - 8}>
                    <button
                      type="button"
                      className="flex w-full items-center gap-1 text-left text-[11px] font-semibold text-slate-900"
                      onClick={() => toggle(p.projectId)}
                    >
                      {open ? (
                        <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                      )}
                      <span className="truncate">
                        {p.projectCode} — {p.projectName}
                      </span>
                    </button>
                  </foreignObject>
                  {s != null && e != null && e > s ? (
                    <>
                      <rect
                        x={xFor(s, min, max, chartLeft, chartW)}
                        y={midY - barH / 2}
                        width={Math.max(
                          xFor(e, min, max, chartLeft, chartW) -
                            xFor(s, min, max, chartLeft, chartW),
                          2,
                        )}
                        height={barH}
                        fill={CHART_SLATE}
                        rx={3}
                        opacity={0.85}
                      >
                        <title>
                          {[
                            p.projectName,
                            `${formatDate(p.startDate)} → ${formatDate(p.endDate)}`,
                            `Giá trị: ${formatCurrencyVND(p.contractValue)}`,
                            `NT: ${formatCurrencyVND(p.actualAcceptanceToDate)}`,
                            `${p.contractCount} hợp đồng`,
                          ].join('\n')}
                        </title>
                      </rect>
                    </>
                  ) : null}
                  <foreignObject
                    x={labelW - 56}
                    y={y + 8}
                    width={52}
                    height={20}
                  >
                    <Link
                      href={`/projects/${p.projectId}/dashboard`}
                      className="text-[9px] text-slate-500 underline"
                    >
                      Chi tiết
                    </Link>
                  </foreignObject>
                </g>
              );
            }

            const c = row.contract;
            const s = parseMs(c.startDate);
            const e = parseMs(c.endDate);
            const barH = 10;
            return (
              <g key={`c-${c.contractId}`}>
                <rect x={0} y={y} width={width} height={rowH} fill="#f1f5f9" />
                <foreignObject x={28} y={y + 6} width={labelW - 36} height={rowH - 8}>
                  <Link
                    href={`/contracts/${c.contractId}/dashboard`}
                    className="block truncate text-[10px] text-slate-700 hover:underline"
                  >
                    {c.contractNo} — {c.name}
                  </Link>
                </foreignObject>
                {s != null && e != null && e > s ? (
                  <rect
                    x={xFor(s, min, max, chartLeft, chartW)}
                    y={midY - barH / 2}
                    width={Math.max(
                      xFor(e, min, max, chartLeft, chartW) -
                        xFor(s, min, max, chartLeft, chartW),
                      2,
                    )}
                    height={barH}
                    fill={CHART_BLUE}
                    rx={2}
                    opacity={0.9}
                  >
                    <title>
                      {[
                        `${c.contractNo} — ${c.name}`,
                        `${formatDate(c.startDate)} → ${formatDate(c.endDate)}`,
                        `Giá trị: ${formatCurrencyVND(c.contractValue)}`,
                        `NT: ${formatCurrencyVND(c.actualAcceptanceToDate)}`,
                        `Thu: ${formatCurrencyVND(c.actualCollectionToDate)}`,
                      ].join('\n')}
                    </title>
                  </rect>
                ) : null}
              </g>
            );
          })}
        </svg>
      </div>
      <div className="flex gap-4 text-xs text-slate-600">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-6 rounded-sm bg-[#475569]" /> Dự án
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-6 rounded-sm bg-[#2563eb]" /> Hợp đồng
        </span>
      </div>
    </div>
  );
}
