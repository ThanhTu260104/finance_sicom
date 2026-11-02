'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { dashboardApi } from '@/lib/api';
import type {
  DashboardQueryParams,
  DashboardReceivablesMonitor,
} from '@/lib/types';
import { overviewQueryKey } from '@/lib/dashboard-query-slices';
import { formatCurrencyVND, formatPeriod } from '@/lib/format';
import { sumDecimalIntStrings } from '@/lib/decimal-gap';
import { shiftPeriodMonths } from '@/lib/period-shift';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  DashboardFilterField,
  DashboardMonthInput,
  DashboardPanelHeader,
  dashboardPanelShellClass,
} from '@/components/dashboard/company/dashboard-panel-header';
import { PERIOD_MONTH_MAX } from '@/lib/period-input-bounds';
import {
  sortDashboardRows,
  useDashboardTableSort,
} from '@/lib/dashboard-table-sort';
import {
  DashboardDataTable,
  SortableDashboardHead,
  DashboardMoneyCell,
  DashboardStickyHeader,
  DashboardTableBody,
  DashboardTableRow,
  DashboardTextCell,
} from '@/components/dashboard/company/dashboard-data-table-shell';

type ReceivablesSortKey =
  | 'period'
  | 'customerName'
  | 'projectCode'
  | 'contractNo'
  | 'acceptanceAmount'
  | 'unpaidAmount'
  | 'agingScore';

function receivablesAgingScore(row: {
  agingDays: number | null;
  daysUntilDue: number | null;
}): number {
  if (row.agingDays != null && row.agingDays > 0) return row.agingDays;
  if (row.daysUntilDue != null) return -row.daysUntilDue;
  return 0;
}

/** Còn ≤ số ngày này tới hạn → nhãn vàng */
const DUE_SOON_DAYS = 15;

function DebtAgePill({
  agingDays,
  daysUntilDue,
}: {
  agingDays: number | null;
  daysUntilDue: number | null;
}) {
  if (agingDays == null && daysUntilDue == null) {
    return <span className="text-slate-400">—</span>;
  }
  if (agingDays != null && agingDays > 0) {
    return (
      <span className="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
        Quá hạn {agingDays} ngày
      </span>
    );
  }
  if (daysUntilDue != null && daysUntilDue > 0) {
    return (
      <span
        className={cn(
          'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
          daysUntilDue <= DUE_SOON_DAYS
            ? 'bg-amber-100 text-amber-800'
            : 'bg-slate-100 text-slate-600',
        )}
      >
        Còn {daysUntilDue} ngày
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
      Đến hạn hôm nay
    </span>
  );
}

function SummaryChip({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string;
  tone?: 'default' | 'red' | 'amber';
}) {
  return (
    <div
      className={cn(
        'rounded-lg border px-3 py-2',
        tone === 'red' && 'border-red-200 bg-red-50',
        tone === 'amber' && 'border-amber-200 bg-amber-50',
        tone === 'default' && 'border-slate-200 bg-slate-50',
      )}
    >
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p
        className={cn(
          'mt-0.5 text-sm font-semibold tabular-nums',
          tone === 'red' ? 'text-red-700' : tone === 'amber' ? 'text-amber-800' : 'text-slate-900',
        )}
      >
        {value}
      </p>
    </div>
  );
}

export function CompanyReceivablesMonitorTable({
  queryParams,
  currentPeriod,
}: {
  queryParams: DashboardQueryParams;
  currentPeriod: string;
}) {
  const defaultTo = currentPeriod;
  const defaultFrom = shiftPeriodMonths(defaultTo, -5);

  const [appliedFrom, setAppliedFrom] = useState(defaultFrom);
  const [appliedTo, setAppliedTo] = useState(defaultTo);
  const [draftFrom, setDraftFrom] = useState(defaultFrom);
  const [draftTo, setDraftTo] = useState(defaultTo);
  const [monitor, setMonitor] = useState<DashboardReceivablesMonitor | null>(
    null,
  );
  const [loading, setLoading] = useState(true);

  const filterKey = overviewQueryKey(queryParams);

  const load = useCallback(
    async (from: string, to: string) => {
      setLoading(true);
      try {
        setMonitor(
          await dashboardApi.receivablesMonitor({
            ...queryParams,
            receivablesFromPeriod: from,
            receivablesToPeriod: to,
          }),
        );
        setAppliedFrom(from);
        setAppliedTo(to);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : 'Không tải được công nợ',
        );
        setMonitor(null);
      } finally {
        setLoading(false);
      }
    },
    [queryParams],
  );

  useEffect(() => {
    const to = currentPeriod;
    const from = shiftPeriodMonths(to, -5);
    setDraftFrom(from);
    setDraftTo(to);
    void load(from, to);
  }, [filterKey, currentPeriod, load]);

  // Mặc định: tuổi nợ cao → thấp (quá hạn lâu nhất lên đầu)
  const { sort, toggleSort } = useDashboardTableSort<ReceivablesSortKey>(
    'agingScore',
    true,
  );

  const rows = useMemo(() => {
    const base = monitor?.rows ?? [];
    return sortDashboardRows(
      base,
      sort,
      (row, key) => {
        switch (key) {
          case 'period':
            return row.period;
          case 'customerName':
            return row.customerName ?? '';
          case 'projectCode':
            return row.projectCode;
          case 'contractNo':
            return row.contractNo;
          case 'acceptanceAmount':
            return row.acceptanceAmount;
          case 'unpaidAmount':
            return row.unpaidAmount;
          case 'agingScore':
            return receivablesAgingScore(row);
          default:
            return '0';
        }
      },
      (key) => {
        if (key === 'agingScore') return 'number';
        if (
          key === 'period' ||
          key === 'customerName' ||
          key === 'projectCode' ||
          key === 'contractNo'
        ) {
          return key === 'period' ? 'period' : 'locale';
        }
        return 'decimal';
      },
    );
  }, [monitor?.rows, sort]);

  const totalUnpaid = useMemo(
    () => sumDecimalIntStrings(rows.map((r) => r.unpaidAmount)),
    [rows],
  );
  const overdueRows = useMemo(
    () => rows.filter((r) => r.agingDays != null && r.agingDays > 0),
    [rows],
  );
  const overdueUnpaid = useMemo(
    () => sumDecimalIntStrings(overdueRows.map((r) => r.unpaidAmount)),
    [overdueRows],
  );
  const maxAging = overdueRows.reduce(
    (m, r) => Math.max(m, r.agingDays ?? 0),
    0,
  );

  return (
    <div className={dashboardPanelShellClass}>
      <DashboardPanelHeader
        title="Theo dõi công nợ chủ đầu tư"
        description={
          monitor
            ? `Kỳ nghiệm thu ${formatPeriod(appliedFrom)} → ${formatPeriod(appliedTo)} · ${rows.length} khoản chưa thu · đã thu đủ không hiển thị`
            : 'Chỉ liệt kê nghiệm thu chưa thu tiền (theo trạng thái và số thu thực tế)'
        }
        filters={
          <>
            <DashboardFilterField id="receivables-from" label="Từ tháng NT">
              <DashboardMonthInput
                id="receivables-from"
                value={draftFrom}
                onChange={setDraftFrom}
              />
            </DashboardFilterField>
            <DashboardFilterField id="receivables-to" label="Đến tháng NT">
              <DashboardMonthInput
                id="receivables-to"
                value={draftTo}
                onChange={setDraftTo}
                max={
                  currentPeriod < PERIOD_MONTH_MAX
                    ? currentPeriod
                    : PERIOD_MONTH_MAX
                }
              />
            </DashboardFilterField>
            <Button
              type="button"
              size="sm"
              className="h-9 shrink-0"
              disabled={loading || !draftFrom || !draftTo}
              onClick={() => {
                if (draftFrom && draftTo) void load(draftFrom, draftTo);
              }}
            >
              Áp dụng
            </Button>
          </>
        }
      />

      {loading && !monitor ? (
        <div className="flex items-center gap-2 px-4 py-8 text-sm text-slate-600">
          <Loader2 className="h-4 w-4 animate-spin" />
          Đang tải…
        </div>
      ) : rows.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-slate-500">
          Không có khoản nghiệm thu chưa thu trong khoảng đã chọn.
        </p>
      ) : (
        <>
          <div className="grid gap-2 border-b border-slate-100 px-4 py-3 sm:grid-cols-4">
            <SummaryChip
              label="Tổng còn phải thu"
              value={formatCurrencyVND(totalUnpaid)}
            />
            <SummaryChip label="Số khoản" value={`${rows.length}`} />
            <SummaryChip
              label={`Quá hạn (${overdueRows.length} khoản)`}
              value={formatCurrencyVND(overdueUnpaid)}
              tone={overdueRows.length > 0 ? 'red' : 'default'}
            />
            <SummaryChip
              label="Quá hạn lâu nhất"
              value={maxAging > 0 ? `${maxAging} ngày` : '—'}
              tone={maxAging > 0 ? 'red' : 'default'}
            />
          </div>
          <DashboardDataTable
            minWidth="60rem"
            maxHeightClass="max-h-[min(30rem,55vh)]"
          >
            <DashboardStickyHeader>
              <SortableDashboardHead
                columnKey="period"
                sortKey={sort.key}
                sortDesc={sort.desc}
                onSort={toggleSort}
                width="13%"
              >
                Đợt nghiệm thu
              </SortableDashboardHead>
              <SortableDashboardHead
                columnKey="contractNo"
                sortKey={sort.key}
                sortDesc={sort.desc}
                onSort={toggleSort}
                width="27%"
              >
                Hợp đồng
              </SortableDashboardHead>
              <SortableDashboardHead
                columnKey="customerName"
                sortKey={sort.key}
                sortDesc={sort.desc}
                onSort={toggleSort}
                width="20%"
              >
                Dự án · Chủ đầu tư
              </SortableDashboardHead>
              <SortableDashboardHead
                columnKey="acceptanceAmount"
                sortKey={sort.key}
                sortDesc={sort.desc}
                onSort={toggleSort}
                align="right"
                width="13%"
              >
                Giá trị NT
              </SortableDashboardHead>
              <SortableDashboardHead
                columnKey="unpaidAmount"
                sortKey={sort.key}
                sortDesc={sort.desc}
                onSort={toggleSort}
                align="right"
                width="13%"
              >
                Còn phải thu
              </SortableDashboardHead>
              <SortableDashboardHead
                columnKey="agingScore"
                sortKey={sort.key}
                sortDesc={sort.desc}
                onSort={toggleSort}
                align="right"
                width="14%"
              >
                Tuổi nợ
              </SortableDashboardHead>
            </DashboardStickyHeader>
            <DashboardTableBody>
              {rows.map((row) => {
                const overdue = row.agingDays != null && row.agingDays > 0;
                return (
                  <DashboardTableRow
                    key={row.acceptanceId}
                    className={cn(overdue && 'bg-red-50/40')}
                  >
                    <DashboardTextCell>
                      <p className="text-sm font-semibold text-slate-900">
                        {row.acceptanceNo}
                      </p>
                      <p className="mt-0.5 text-xs tabular-nums text-slate-500">
                        Kỳ {formatPeriod(row.period)}
                      </p>
                    </DashboardTextCell>
                    <DashboardTextCell>
                      <Link
                        href={`/contracts/${row.contractId}?tab=acceptances`}
                        className="font-mono text-xs font-semibold text-slate-900 underline-offset-2 hover:underline"
                      >
                        {row.contractNo}
                      </Link>
                      {row.contractName ? (
                        <p
                          className="mt-0.5 line-clamp-1 text-xs text-slate-500"
                          title={row.contractName}
                        >
                          {row.contractName}
                        </p>
                      ) : null}
                    </DashboardTextCell>
                    <DashboardTextCell>
                      <p className="font-mono text-xs font-medium text-slate-700">
                        {row.projectCode}
                      </p>
                      <p
                        className="mt-0.5 line-clamp-1 text-xs text-slate-500"
                        title={row.customerName ?? undefined}
                      >
                        {row.customerName ?? '—'}
                      </p>
                    </DashboardTextCell>
                    <DashboardMoneyCell>
                      {formatCurrencyVND(row.acceptanceAmount)}
                    </DashboardMoneyCell>
                    <DashboardMoneyCell emphasize="red">
                      {formatCurrencyVND(row.unpaidAmount)}
                    </DashboardMoneyCell>
                    <DashboardTextCell className="text-right">
                      <DebtAgePill
                        agingDays={row.agingDays}
                        daysUntilDue={row.daysUntilDue}
                      />
                    </DashboardTextCell>
                  </DashboardTableRow>
                );
              })}
              <DashboardTableRow className="bg-slate-50/90 font-semibold hover:bg-slate-50/90">
                <DashboardTextCell colSpan={4} className="text-sm text-slate-800">
                  Tổng còn phải thu ({rows.length} khoản)
                </DashboardTextCell>
                <DashboardMoneyCell emphasize="red">
                  {formatCurrencyVND(totalUnpaid)}
                </DashboardMoneyCell>
                <DashboardTextCell>{null}</DashboardTextCell>
              </DashboardTableRow>
            </DashboardTableBody>
          </DashboardDataTable>
        </>
      )}
    </div>
  );
}
