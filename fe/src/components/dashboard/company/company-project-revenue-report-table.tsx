'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { DashboardProjectRevenueReport } from '@/lib/types';
import { formatCurrencyVND, formatPeriod } from '@/lib/format';
import { sumDecimalIntStrings } from '@/lib/decimal-gap';
import { cn } from '@/lib/utils';
import { Select } from '@/components/ui/select';
import {
  DashboardFilterField,
  DashboardMonthInput,
  DashboardPanelHeader,
  dashboardPanelShellClass,
} from '@/components/dashboard/company/dashboard-panel-header';
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

const UNASSIGNED_KST = '__unassigned_kst__';

type RevenueReportSortKey =
  | 'projectCode'
  | 'plannedAcceptance'
  | 'actualAcceptance'
  | 'actualCollection'
  | 'operatingCost';

export function CompanyProjectRevenueReportTable({
  report,
  kpiPeriod,
  onKpiPeriodChange,
  metricsStale = false,
  includeOperatingCost = false,
}: {
  report: DashboardProjectRevenueReport;
  kpiPeriod: string;
  onKpiPeriodChange: (period: string) => void;
  metricsStale?: boolean;
  includeOperatingCost?: boolean;
}) {
  const periodKey = kpiPeriod.trim() || report.period;
  const stale = metricsStale || report.period !== periodKey;
  const [projectFilter, setProjectFilter] = useState('');
  const [kstFilter, setKstFilter] = useState('');
  const { sort, toggleSort } = useDashboardTableSort<RevenueReportSortKey>(
    'plannedAcceptance',
    true,
  );

  const projectOptions = useMemo(() => {
    const byId = new Map<string, string>();
    for (const row of report.rows) {
      if (!byId.has(row.projectId)) {
        byId.set(row.projectId, `${row.projectCode} — ${row.projectName}`);
      }
    }
    return [...byId.entries()]
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label, 'vi'));
  }, [report.rows]);

  const kstOptions = useMemo(() => {
    const names = new Set<string>();
    let hasUnassigned = false;
    for (const row of report.rows) {
      const name = row.projectManagerName?.trim();
      if (name) names.add(name);
      else hasUnassigned = true;
    }
    const options = [...names]
      .sort((a, b) => a.localeCompare(b, 'vi'))
      .map((name) => ({ key: name, label: name }));
    if (hasUnassigned) {
      options.push({ key: UNASSIGNED_KST, label: 'Chưa gán KST' });
    }
    return options;
  }, [report.rows]);

  useEffect(() => {
    if (projectFilter && !projectOptions.some((p) => p.id === projectFilter)) {
      setProjectFilter('');
    }
  }, [projectFilter, projectOptions]);

  useEffect(() => {
    if (kstFilter && !kstOptions.some((k) => k.key === kstFilter)) {
      setKstFilter('');
    }
  }, [kstFilter, kstOptions]);

  const filteredRows = useMemo(() => {
    return report.rows.filter((row) => {
      if (projectFilter && row.projectId !== projectFilter) return false;
      if (!kstFilter) return true;
      const pm = row.projectManagerName?.trim() || null;
      if (kstFilter === UNASSIGNED_KST) return pm == null;
      return pm === kstFilter;
    });
  }, [report.rows, projectFilter, kstFilter]);

  const rows = useMemo(
    () =>
      sortDashboardRows(
        filteredRows,
        sort,
        (row, key) => {
          switch (key) {
            case 'projectCode':
              return row.projectCode;
            case 'plannedAcceptance':
              return row.plannedAcceptance;
            case 'actualAcceptance':
              return row.actualAcceptance;
            case 'actualCollection':
              return row.actualCollection;
            case 'operatingCost':
              return row.operatingCost;
            default:
              return '0';
          }
        },
        (key) => (key === 'projectCode' ? 'locale' : 'decimal'),
      ),
    [filteredRows, sort],
  );

  const totals = useMemo(
    () => ({
      planned: sumDecimalIntStrings(rows.map((r) => r.plannedAcceptance)),
      actual: sumDecimalIntStrings(rows.map((r) => r.actualAcceptance)),
      collected: sumDecimalIntStrings(rows.map((r) => r.actualCollection)),
      cost: sumDecimalIntStrings(rows.map((r) => r.operatingCost)),
    }),
    [rows],
  );

  const label = formatPeriod(periodKey);

  return (
    <div className={dashboardPanelShellClass}>
      <DashboardPanelHeader
        title={
          includeOperatingCost
            ? `Báo cáo doanh thu / chi phí theo dự án — tháng ${label}`
            : `Báo cáo doanh thu theo dự án — tháng ${label}`
        }
        description={
          includeOperatingCost
            ? 'Kế hoạch nghiệm thu (kỳ KH) · NT thực tế (kỳ KH) · thu tiền · chi phí dự án'
            : 'Kế hoạch nghiệm thu (kỳ KH) · NT thực tế (kỳ KH) · thu tiền'
        }
        filters={
          <>
            <DashboardFilterField id="project-revenue-period" label="Tháng / năm">
              <DashboardMonthInput
                id="project-revenue-period"
                value={periodKey}
                onChange={onKpiPeriodChange}
              />
            </DashboardFilterField>
            <DashboardFilterField
              id="project-revenue-project"
              label="Dự án"
              className="w-[13rem]"
            >
              <Select
                id="project-revenue-project"
                className="h-9 bg-white"
                value={projectFilter}
                onChange={(e) => setProjectFilter(e.target.value)}
              >
                <option value="">Tất cả dự án</option>
                {projectOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </Select>
            </DashboardFilterField>
            <DashboardFilterField
              id="project-revenue-kst"
              label="Kỹ sư trưởng"
              className="w-[13rem]"
            >
              <Select
                id="project-revenue-kst"
                className="h-9 bg-white"
                value={kstFilter}
                onChange={(e) => setKstFilter(e.target.value)}
              >
                <option value="">Tất cả KST</option>
                {kstOptions.map((k) => (
                  <option key={k.key} value={k.key}>
                    {k.label}
                  </option>
                ))}
              </Select>
            </DashboardFilterField>
          </>
        }
      />

      <div className={cn(stale && 'opacity-60 transition-opacity')}>
        {rows.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-slate-500">
            Không có số liệu theo dự án trong tháng {label}.
          </p>
        ) : (
          <DashboardDataTable
            minWidth={includeOperatingCost ? '46rem' : '38rem'}
            maxHeightClass="max-h-[min(28rem,50vh)]"
            footer={
              <DashboardTableBody>
                <DashboardTableRow className="bg-slate-50/90 font-semibold hover:bg-slate-50/90 [&_td]:border-t [&_td]:border-slate-200/80 [&_td]:border-b-0">
                  <DashboardTextCell colSpan={2} className="text-slate-800">
                    Tổng ({rows.length} dự án)
                  </DashboardTextCell>
                  <DashboardMoneyCell>
                    {formatCurrencyVND(totals.planned)}
                  </DashboardMoneyCell>
                  <DashboardMoneyCell>
                    {formatCurrencyVND(totals.actual)}
                  </DashboardMoneyCell>
                  <DashboardMoneyCell>
                    {formatCurrencyVND(totals.collected)}
                  </DashboardMoneyCell>
                  {includeOperatingCost ? (
                    <DashboardMoneyCell>
                      {formatCurrencyVND(totals.cost)}
                    </DashboardMoneyCell>
                  ) : null}
                </DashboardTableRow>
              </DashboardTableBody>
            }
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
              <DashboardHead width="22%">Dự án · KST</DashboardHead>
              <SortableDashboardHead
                columnKey="plannedAcceptance"
                sortKey={sort.key}
                sortDesc={sort.desc}
                onSort={toggleSort}
                align="right"
                width="18%"
              >
                Kế hoạch nghiệm thu
              </SortableDashboardHead>
              <SortableDashboardHead
                columnKey="actualAcceptance"
                sortKey={sort.key}
                sortDesc={sort.desc}
                onSort={toggleSort}
                align="right"
                width="18%"
              >
                NT thực tế
              </SortableDashboardHead>
              <SortableDashboardHead
                columnKey="actualCollection"
                sortKey={sort.key}
                sortDesc={sort.desc}
                onSort={toggleSort}
                align="right"
                width="18%"
              >
                Thu tiền
              </SortableDashboardHead>
              {includeOperatingCost ? (
                <SortableDashboardHead
                  columnKey="operatingCost"
                  sortKey={sort.key}
                  sortDesc={sort.desc}
                  onSort={toggleSort}
                  align="right"
                  width="17%"
                >
                  Chi phí dự án
                </SortableDashboardHead>
              ) : null}
            </DashboardStickyHeader>
            <DashboardTableBody>
              {rows.map((row) => (
                <DashboardTableRow key={row.projectId}>
                  <DashboardTextCell className="font-mono text-xs">
                    <Link
                      href={`/projects/${row.projectId}/dashboard?projectPeriod=${periodKey}`}
                      className="font-medium text-slate-900 underline-offset-2 hover:underline"
                    >
                      {row.projectCode}
                    </Link>
                  </DashboardTextCell>
                  <DashboardTextCell className="align-top">
                    <p className="line-clamp-2 text-sm text-slate-900">
                      {row.projectName}
                    </p>
                    {row.projectManagerName ? (
                      <p className="mt-0.5 text-xs text-slate-500">
                        KST: {row.projectManagerName}
                      </p>
                    ) : null}
                    {row.customerName ? (
                      <p className="mt-0.5 text-xs text-slate-400">
                        {row.customerName}
                      </p>
                    ) : null}
                  </DashboardTextCell>
                  <DashboardMoneyCell>
                    {formatCurrencyVND(row.plannedAcceptance)}
                  </DashboardMoneyCell>
                  <DashboardMoneyCell>
                    {formatCurrencyVND(row.actualAcceptance)}
                  </DashboardMoneyCell>
                  <DashboardMoneyCell>
                    {formatCurrencyVND(row.actualCollection)}
                  </DashboardMoneyCell>
                  {includeOperatingCost ? (
                    <DashboardMoneyCell>
                      {formatCurrencyVND(row.operatingCost)}
                    </DashboardMoneyCell>
                  ) : null}
                </DashboardTableRow>
              ))}
            </DashboardTableBody>
          </DashboardDataTable>
        )}
      </div>
    </div>
  );
}
