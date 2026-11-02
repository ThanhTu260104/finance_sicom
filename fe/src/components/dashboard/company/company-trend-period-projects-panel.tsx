'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { dashboardApi } from '@/lib/api';
import type {
  DashboardQueryParams,
  DashboardTrendProjectPeriodBreakdown,
} from '@/lib/types';
import { overviewQueryKey } from '@/lib/dashboard-query-slices';
import {
  formatCurrencyVND,
  formatPercentDisplay,
  formatPeriod,
} from '@/lib/format';
import { Button } from '@/components/ui/button';
import {
  sortDashboardRows,
  useDashboardTableSort,
} from '@/lib/dashboard-table-sort';
import {
  DashboardDataTable,
  DashboardHead,
  SortableDashboardHead,
  DashboardMoneyCell,
  DashboardStickyHeader,
  DashboardTableBody,
  DashboardTableRow,
  DashboardTextCell,
} from '@/components/dashboard/company/dashboard-data-table-shell';

type TrendProjectSortKey =
  | 'projectCode'
  | 'plannedAcceptance'
  | 'actualWork'
  | 'actualAcceptance'
  | 'actualCollection'
  | 'operatingCost'
  | 'acceptanceGap'
  | 'collectionGap'
  | 'acceptanceProgressPeriod';

export function CompanyTrendPeriodProjectsPanel({
  period,
  queryParams,
  showOperatingCost,
  onClose,
}: {
  period: string;
  queryParams: DashboardQueryParams;
  showOperatingCost: boolean;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [breakdown, setBreakdown] =
    useState<DashboardTrendProjectPeriodBreakdown | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void dashboardApi
      .trendByProject(period, queryParams)
      .then((res) => {
        if (!cancelled) setBreakdown(res);
      })
      .catch((err) => {
        if (!cancelled) {
          toast.error(
            err instanceof Error ? err.message : 'Không tải chi tiết dự án',
          );
          setBreakdown(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [period, overviewQueryKey(queryParams)]);

  const label = formatPeriod(period);
  const { sort, toggleSort } = useDashboardTableSort<TrendProjectSortKey>(
    'acceptanceGap',
    true,
  );
  const baseRows = breakdown?.rows ?? [];
  const rows = useMemo(
    () =>
      sortDashboardRows(
        baseRows,
        sort,
        (row, key) => {
          switch (key) {
            case 'projectCode':
              return row.projectCode;
            case 'plannedAcceptance':
              return row.plannedAcceptance;
            case 'actualWork':
              return row.actualWork ?? '0';
            case 'actualAcceptance':
              return row.actualAcceptance;
            case 'actualCollection':
              return row.actualCollection;
            case 'operatingCost':
              return row.operatingCost;
            case 'acceptanceGap':
              return row.acceptanceGap;
            case 'collectionGap':
              return row.collectionGap;
            case 'acceptanceProgressPeriod':
              return row.acceptanceProgressPeriod ?? '0';
            default:
              return '0';
          }
        },
        (key) => (key === 'projectCode' ? 'locale' : 'decimal'),
      ),
    [baseRows, sort],
  );
  const delayedCount = baseRows.filter((r) => r.behindSchedule).length;

  return (
    <div className="rounded-lg border border-teal-200 bg-teal-50/30 p-3">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h4 className="text-sm font-semibold text-slate-900">
            Chi tiết theo dự án — tháng {label}
          </h4>
          <p className="mt-0.5 text-xs text-slate-600">
            Nghiệm thu · thu tiền trong tháng
            {delayedCount > 0
              ? ` · ${delayedCount} dự án trễ so với kế hoạch NT`
              : ''}
          </p>
        </div>
        <Button type="button" size="sm" variant="ghost" onClick={onClose}>
          <X className="h-4 w-4" />
          Đóng
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-8 text-sm text-slate-600">
          <Loader2 className="h-4 w-4 animate-spin" />
          Đang tải…
        </div>
      ) : rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-500">
          Không có số liệu nghiệm thu / thu tiền theo dự án trong tháng này.
        </p>
      ) : (
        <DashboardDataTable
          minWidth={showOperatingCost ? '52rem' : '46rem'}
          maxHeightClass="max-h-[min(24rem,45vh)]"
        >
          <DashboardStickyHeader>
            <SortableDashboardHead
              columnKey="projectCode"
              sortKey={sort.key}
              sortDesc={sort.desc}
              onSort={toggleSort}
              width="10%"
            >
              Mã dự án
            </SortableDashboardHead>
            <DashboardHead width="18%">Dự án</DashboardHead>
            <SortableDashboardHead
              columnKey="plannedAcceptance"
              sortKey={sort.key}
              sortDesc={sort.desc}
              onSort={toggleSort}
              align="right"
              width="10%"
            >
              Kế hoạch NT
            </SortableDashboardHead>
            <SortableDashboardHead
              columnKey="actualWork"
              sortKey={sort.key}
              sortDesc={sort.desc}
              onSort={toggleSort}
              align="right"
              width="10%"
            >
              Thực hiện
            </SortableDashboardHead>
            <SortableDashboardHead
              columnKey="actualAcceptance"
              sortKey={sort.key}
              sortDesc={sort.desc}
              onSort={toggleSort}
              align="right"
              width="11%"
            >
              NT thực tế
            </SortableDashboardHead>
            <SortableDashboardHead
              columnKey="actualCollection"
              sortKey={sort.key}
              sortDesc={sort.desc}
              onSort={toggleSort}
              align="right"
              width="11%"
            >
              Thu tiền
            </SortableDashboardHead>
            {showOperatingCost ? (
              <SortableDashboardHead
                columnKey="operatingCost"
                sortKey={sort.key}
                sortDesc={sort.desc}
                onSort={toggleSort}
                align="right"
                width="9%"
              >
                Chi phí
              </SortableDashboardHead>
            ) : null}
            <SortableDashboardHead
              columnKey="acceptanceGap"
              sortKey={sort.key}
              sortDesc={sort.desc}
              onSort={toggleSort}
              align="right"
              width="11%"
            >
              Chênh lệch KH − NT
            </SortableDashboardHead>
            <SortableDashboardHead
              columnKey="collectionGap"
              sortKey={sort.key}
              sortDesc={sort.desc}
              onSort={toggleSort}
              align="right"
              width="10%"
            >
              Chênh NT − thu
            </SortableDashboardHead>
            <SortableDashboardHead
              columnKey="acceptanceProgressPeriod"
              sortKey={sort.key}
              sortDesc={sort.desc}
              onSort={toggleSort}
              align="right"
              width="8%"
            >
              Tỷ lệ NT
            </SortableDashboardHead>
          </DashboardStickyHeader>
          <DashboardTableBody>
            {rows.map((row) => (
              <DashboardTableRow
                key={row.projectId}
                className={
                  row.behindSchedule ? 'bg-amber-50/50' : undefined
                }
              >
                <DashboardTextCell className="font-mono text-xs">
                  <Link
                    href={`/projects/${row.projectId}/dashboard?projectPeriod=${period}`}
                    className="font-medium text-slate-900 underline-offset-2 hover:underline"
                  >
                    {row.projectCode}
                  </Link>
                </DashboardTextCell>
                <DashboardTextCell className="align-top">
                  <p className="line-clamp-2 text-sm text-slate-900">
                    {row.projectName}
                  </p>
                  {row.customerName ? (
                    <p className="mt-0.5 text-xs text-slate-500">
                      {row.customerName}
                    </p>
                  ) : null}
                  {row.behindSchedule ? (
                    <span className="mt-1 inline-block rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-900">
                      Trễ kế hoạch NT
                    </span>
                  ) : null}
                </DashboardTextCell>
                <DashboardMoneyCell>
                  {formatCurrencyVND(row.plannedAcceptance)}
                </DashboardMoneyCell>
                <DashboardMoneyCell>
                  {formatCurrencyVND(row.actualWork ?? '0')}
                </DashboardMoneyCell>
                <DashboardMoneyCell>
                  {formatCurrencyVND(row.actualAcceptance)}
                </DashboardMoneyCell>
                <DashboardMoneyCell>
                  {formatCurrencyVND(row.actualCollection)}
                </DashboardMoneyCell>
                {showOperatingCost ? (
                  <DashboardMoneyCell>
                    {formatCurrencyVND(row.operatingCost)}
                  </DashboardMoneyCell>
                ) : null}
                <DashboardMoneyCell emphasize="amber">
                  {formatCurrencyVND(row.acceptanceGap)}
                </DashboardMoneyCell>
                <DashboardMoneyCell emphasize="red">
                  {formatCurrencyVND(row.collectionGap)}
                </DashboardMoneyCell>
                <DashboardTextCell className="text-right tabular-nums text-slate-700">
                  {formatPercentDisplay(row.acceptanceProgressPeriod)}
                </DashboardTextCell>
              </DashboardTableRow>
            ))}
          </DashboardTableBody>
        </DashboardDataTable>
      )}
    </div>
  );
}
