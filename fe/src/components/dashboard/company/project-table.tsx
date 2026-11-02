'use client';

import Link from 'next/link';
import { useMemo, type ReactNode } from 'react';
import type { DashboardByProjectRow } from '@/lib/types';
import {
  formatCurrencyVND,
  formatPercentDisplay,
  formatPeriod,
} from '@/lib/format';
import { projectAcceptanceEvaluation } from '@/lib/project-acceptance-evaluation';
import {
  sortDashboardRows,
  useDashboardTableSort,
} from '@/lib/dashboard-table-sort';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';

type SortKey =
  | 'projectCode'
  | 'contractValue'
  | 'plannedAcceptanceToDate'
  | 'plannedAcceptanceCurrentPeriod'
  | 'actualAcceptanceCurrentPeriod'
  | 'actualAcceptanceToDate'
  | 'acceptanceGap'
  | 'actualCollectionToDate'
  | 'acceptancePercent'
  | 'collectionPercent';

function SituationSortHead({
  columnKey,
  sortKey,
  sortDesc,
  onSort,
  className,
  children,
}: {
  columnKey: SortKey;
  sortKey: SortKey;
  sortDesc: boolean;
  onSort: (key: SortKey) => void;
  className?: string;
  children: ReactNode;
}) {
  const active = sortKey === columnKey;
  return (
    <TableHead className={className}>
      <button
        type="button"
        onClick={() => onSort(columnKey)}
        className={cn(
          'inline-flex items-center gap-0.5 hover:text-slate-950',
          active && 'font-bold text-slate-950',
        )}
        aria-sort={active ? (sortDesc ? 'descending' : 'ascending') : 'none'}
      >
        {children}
        {active ? (
          sortDesc ? (
            <ArrowDown className="h-3.5 w-3.5 opacity-80" aria-hidden />
          ) : (
            <ArrowUp className="h-3.5 w-3.5 opacity-80" aria-hidden />
          )
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-35" aria-hidden />
        )}
      </button>
    </TableHead>
  );
}

export function ProjectSituationTable({
  rows,
  currentPeriod,
}: {
  rows: DashboardByProjectRow[];
  currentPeriod?: string;
}) {
  const monthLabel = currentPeriod ? formatPeriod(currentPeriod) : 'hiện tại';
  const { sort, toggleSort } = useDashboardTableSort<SortKey>(
    'acceptanceGap',
    true,
  );

  const sorted = useMemo(
    () =>
      sortDashboardRows(
        rows,
        sort,
        (row, key) => {
          switch (key) {
            case 'projectCode':
              return row.projectCode;
            case 'contractValue':
              return row.contractValue;
            case 'plannedAcceptanceToDate':
              return row.plannedAcceptanceToDate;
            case 'plannedAcceptanceCurrentPeriod':
              return row.plannedAcceptanceCurrentPeriod ?? '0';
            case 'actualAcceptanceCurrentPeriod':
              return row.actualAcceptanceCurrentPeriod ?? '0';
            case 'actualAcceptanceToDate':
              return row.actualAcceptanceToDate;
            case 'acceptanceGap':
              return row.acceptanceGap;
            case 'actualCollectionToDate':
              return row.actualCollectionToDate;
            case 'acceptancePercent':
              return row.acceptancePercent;
            case 'collectionPercent':
              return row.collectionPercent;
            default:
              return '0';
          }
        },
        (key) => (key === 'projectCode' ? 'locale' : 'decimal'),
      ),
    [rows, sort],
  );

  if (rows.length === 0) {
    return <p className="text-sm text-slate-500">Chưa có dự án.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <Table>
        <TableHeader>
          <TableRow>
            <SituationSortHead
              columnKey="projectCode"
              sortKey={sort.key}
              sortDesc={sort.desc}
              onSort={toggleSort}
            >
              Dự án
            </SituationSortHead>
            <SituationSortHead
              columnKey="contractValue"
              sortKey={sort.key}
              sortDesc={sort.desc}
              onSort={toggleSort}
              className="text-right"
            >
              Giá trị HĐ
            </SituationSortHead>
            <SituationSortHead
              columnKey="plannedAcceptanceToDate"
              sortKey={sort.key}
              sortDesc={sort.desc}
              onSort={toggleSort}
              className="text-right"
            >
              KH NT
            </SituationSortHead>
            <SituationSortHead
              columnKey="plannedAcceptanceCurrentPeriod"
              sortKey={sort.key}
              sortDesc={sort.desc}
              onSort={toggleSort}
              className="text-right"
            >
              KH tháng {monthLabel}
            </SituationSortHead>
            <SituationSortHead
              columnKey="actualAcceptanceCurrentPeriod"
              sortKey={sort.key}
              sortDesc={sort.desc}
              onSort={toggleSort}
              className="text-right"
            >
              NT tháng {monthLabel}
            </SituationSortHead>
            <SituationSortHead
              columnKey="actualAcceptanceToDate"
              sortKey={sort.key}
              sortDesc={sort.desc}
              onSort={toggleSort}
              className="text-right"
            >
              NT thực tế
            </SituationSortHead>
            <SituationSortHead
              columnKey="acceptanceGap"
              sortKey={sort.key}
              sortDesc={sort.desc}
              onSort={toggleSort}
              className="text-right"
            >
              Chênh lệch NT
            </SituationSortHead>
            <SituationSortHead
              columnKey="actualCollectionToDate"
              sortKey={sort.key}
              sortDesc={sort.desc}
              onSort={toggleSort}
              className="text-right"
            >
              Thu thực tế
            </SituationSortHead>
            <SituationSortHead
              columnKey="acceptancePercent"
              sortKey={sort.key}
              sortDesc={sort.desc}
              onSort={toggleSort}
              className="text-right"
            >
              % NT
            </SituationSortHead>
            <SituationSortHead
              columnKey="collectionPercent"
              sortKey={sort.key}
              sortDesc={sort.desc}
              onSort={toggleSort}
              className="text-right"
            >
              % thu
            </SituationSortHead>
            <TableHead>Đánh giá (NT/HĐ)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((row) => (
            <TableRow key={row.projectId}>
              <TableCell>
                <Link
                  href={`/projects/${row.projectId}/dashboard`}
                  className="font-medium hover:underline"
                >
                  {row.projectCode}
                </Link>
                <p className="text-xs text-slate-600">{row.projectName}</p>
              </TableCell>
              <TableCell className="text-right tabular-nums text-sm">
                {formatCurrencyVND(row.contractValue)}
              </TableCell>
              <TableCell className="text-right tabular-nums text-sm">
                {formatCurrencyVND(row.plannedAcceptanceToDate)}
              </TableCell>
              <TableCell className="text-right tabular-nums text-sm">
                {formatCurrencyVND(
                  row.plannedAcceptanceCurrentPeriod ?? '0',
                )}
              </TableCell>
              <TableCell className="text-right tabular-nums text-sm">
                {formatCurrencyVND(
                  row.actualAcceptanceCurrentPeriod ?? '0',
                )}
              </TableCell>
              <TableCell className="text-right tabular-nums text-sm">
                {formatCurrencyVND(row.actualAcceptanceToDate)}
              </TableCell>
              <TableCell className="text-right tabular-nums text-sm">
                {formatCurrencyVND(row.acceptanceGap)}
              </TableCell>
              <TableCell className="text-right tabular-nums text-sm">
                {formatCurrencyVND(row.actualCollectionToDate)}
              </TableCell>
              <TableCell className="text-right tabular-nums text-sm">
                {formatPercentDisplay(row.acceptancePercent)}
              </TableCell>
              <TableCell className="text-right tabular-nums text-sm">
                {formatPercentDisplay(row.collectionPercent)}
              </TableCell>
              <TableCell className="text-sm">
                {(() => {
                  const ev = projectAcceptanceEvaluation(row);
                  return (
                    <span className={`font-medium ${ev.className}`}>
                      {ev.label}
                    </span>
                  );
                })()}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
