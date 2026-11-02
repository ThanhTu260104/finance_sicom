'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import type { DashboardExpiringContractRow } from '@/lib/types';
import { formatCurrencyVND, formatDate } from '@/lib/format';
import { contractStatusLabel } from '@/components/shared/status-badges';
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

type ExpiringSortKey =
  | 'projectCode'
  | 'contractNo'
  | 'customerName'
  | 'endDate'
  | 'contractValue';

export function ExpiringContractsTable({
  rows,
}: {
  rows: DashboardExpiringContractRow[];
}) {
  const { sort, toggleSort } = useDashboardTableSort<ExpiringSortKey>(
    'endDate',
    false,
  );

  const sortedRows = useMemo(
    () =>
      sortDashboardRows(
        rows,
        sort,
        (row, key) => {
          switch (key) {
            case 'projectCode':
              return row.projectCode;
            case 'contractNo':
              return row.contractNo;
            case 'customerName':
              return row.customerName ?? '';
            case 'endDate':
              return row.endDate ?? '';
            case 'contractValue':
              return row.contractValue;
            default:
              return '0';
          }
        },
        (key) => {
          if (key === 'endDate') return 'period';
          if (key === 'contractValue') return 'decimal';
          return 'locale';
        },
      ),
    [rows, sort],
  );

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-4 py-3">
        <h3 className="text-sm font-semibold text-slate-900">
          Hợp đồng sắp hết hạn
        </h3>
        <p className="mt-0.5 text-xs text-slate-500">
          HĐ đang hiệu lực, ngày kết thúc trong 6 tháng tới
        </p>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-slate-500">
          Không có hợp đồng sắp hết hạn trong 6 tháng tới.
        </p>
      ) : (
        <DashboardDataTable minWidth="52rem" maxHeightClass="max-h-[min(28rem,50vh)]">
          <DashboardStickyHeader>
            <SortableDashboardHead
              columnKey="projectCode"
              sortKey={sort.key}
              sortDesc={sort.desc}
              onSort={toggleSort}
              width="12%"
            >
              Mã dự án
            </SortableDashboardHead>
            <SortableDashboardHead
              columnKey="contractNo"
              sortKey={sort.key}
              sortDesc={sort.desc}
              onSort={toggleSort}
              width="20%"
            >
              Hợp đồng
            </SortableDashboardHead>
            <SortableDashboardHead
              columnKey="customerName"
              sortKey={sort.key}
              sortDesc={sort.desc}
              onSort={toggleSort}
              width="16%"
            >
              Chủ đầu tư
            </SortableDashboardHead>
            <SortableDashboardHead
              columnKey="endDate"
              sortKey={sort.key}
              sortDesc={sort.desc}
              onSort={toggleSort}
              width="12%"
            >
              Ngày hết hạn
            </SortableDashboardHead>
            <SortableDashboardHead
              columnKey="contractValue"
              sortKey={sort.key}
              sortDesc={sort.desc}
              onSort={toggleSort}
              align="right"
              width="14%"
            >
              Giá trị hợp đồng
            </SortableDashboardHead>
            <DashboardHead width="12%">Trạng thái</DashboardHead>
          </DashboardStickyHeader>
          <DashboardTableBody>
            {sortedRows.map((row) => (
              <DashboardTableRow key={row.contractId}>
                <DashboardTextCell className="align-top">
                  <p className="font-mono text-xs font-medium">
                    {row.projectCode}
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-slate-500">
                    {row.projectName}
                  </p>
                </DashboardTextCell>
                <DashboardTextCell className="align-top">
                  <Link
                    href={`/contracts/${row.contractId}`}
                    className="text-sm font-medium underline-offset-2 hover:underline"
                  >
                    {row.contractNo}
                  </Link>
                  <p className="mt-0.5 line-clamp-2 text-slate-500">
                    {row.contractName}
                  </p>
                </DashboardTextCell>
                <DashboardTextCell className="max-w-[10rem] text-slate-700">
                  {row.customerName ?? '—'}
                </DashboardTextCell>
                <DashboardTextCell className="whitespace-nowrap tabular-nums">
                  {formatDate(row.endDate)}
                </DashboardTextCell>
                <DashboardMoneyCell>
                  {formatCurrencyVND(row.contractValue)}
                </DashboardMoneyCell>
                <DashboardTextCell className="whitespace-nowrap">
                  {contractStatusLabel[row.status]}
                </DashboardTextCell>
              </DashboardTableRow>
            ))}
          </DashboardTableBody>
        </DashboardDataTable>
      )}
    </div>
  );
}
