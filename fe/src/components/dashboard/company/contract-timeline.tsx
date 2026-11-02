'use client';

import Link from 'next/link';
import type { DashboardTimelineItem, DashboardTimelineResponse } from '@/lib/types';
import { formatCurrencyVND, formatDate } from '@/lib/format';
import { HorizontalPeriodBar } from '@/components/dashboard/shared/horizontal-period-bar';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export function ContractTimelineSection({
  data,
  asOf,
  loading,
  onPageChange,
}: {
  data: DashboardTimelineResponse | null;
  asOf: string;
  loading?: boolean;
  onPageChange: (page: number) => void;
}) {
  if (loading) {
    return <p className="text-sm text-slate-500">Đang tải timeline…</p>;
  }
  if (!data) {
    return <p className="text-sm text-slate-500">Chưa có dữ liệu timeline.</p>;
  }
  if (data.items.length === 0) {
    return <p className="text-sm text-slate-500">Chưa có hợp đồng phù hợp bộ lọc.</p>;
  }

  const { pagination } = data;

  return (
    <div className="space-y-4">
      <div className="hidden lg:block overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Hợp đồng</TableHead>
              <TableHead>Dự án / Khách hàng</TableHead>
              <TableHead className="min-w-[280px]">Thời hạn</TableHead>
              <TableHead className="text-right">Giá trị</TableHead>
              <TableHead className="text-right">% thời gian</TableHead>
              <TableHead className="text-right">% NT</TableHead>
              <TableHead className="text-right">% thu</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.items.map((row) => (
              <TimelineRow key={row.contractId} row={row} asOf={asOf} />
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="space-y-3 lg:hidden">
        {data.items.map((row) => (
          <TimelineCard key={row.contractId} row={row} asOf={asOf} />
        ))}
      </div>
      <PaginationBar pagination={pagination} onPageChange={onPageChange} />
    </div>
  );
}

function TimelineRow({ row, asOf }: { row: DashboardTimelineItem; asOf: string }) {
  const tip = tooltipLines(row);
  return (
    <TableRow className="hover:bg-slate-50">
      <TableCell title={tip}>
        <Link
          href={`/contracts/${row.contractId}/dashboard`}
          className="font-medium text-slate-900 underline-offset-2 hover:underline"
        >
          {row.contractNo}
        </Link>
        <p className="text-xs text-slate-600">{row.name}</p>
      </TableCell>
      <TableCell className="text-xs">
        <p>{row.projectName}</p>
        <p className="text-slate-500">{row.customerName ?? '—'}</p>
      </TableCell>
      <TableCell>
        <HorizontalPeriodBar
          startDate={row.startDate}
          endDate={row.endDate}
          asOf={asOf}
        />
      </TableCell>
      <TableCell className="text-right tabular-nums text-sm">
        {formatCurrencyVND(row.contractValue)}
      </TableCell>
      <TableCell className="text-right tabular-nums text-sm">
        {row.timeProgressPercent ?? '—'}%
      </TableCell>
      <TableCell className="text-right tabular-nums text-sm">
        {row.acceptancePercent}%
      </TableCell>
      <TableCell className="text-right tabular-nums text-sm">
        {row.collectionPercent}%
      </TableCell>
    </TableRow>
  );
}

function TimelineCard({ row, asOf }: { row: DashboardTimelineItem; asOf: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <Link
        href={`/contracts/${row.contractId}/dashboard`}
        className="font-semibold text-slate-900"
      >
        {row.contractNo}
      </Link>
      <p className="text-sm text-slate-600">{row.name}</p>
      <HorizontalPeriodBar
        className="mt-2"
        startDate={row.startDate}
        endDate={row.endDate}
        asOf={asOf}
      />
    </div>
  );
}

function tooltipLines(row: DashboardTimelineItem) {
  return [
    `${row.contractNo} — ${row.name}`,
    `Dự án: ${row.projectName}`,
    `KH: ${row.customerName ?? '—'}`,
    `${formatDate(row.startDate)} → ${formatDate(row.endDate)}`,
    `Giá trị: ${formatCurrencyVND(row.contractValue)}`,
    `Chênh lệch NT: ${formatCurrencyVND(row.acceptanceGap)}`,
    `Thu thực tế: ${formatCurrencyVND(row.actualCollectionToDate)}`,
  ].join('\n');
}

function PaginationBar({
  pagination,
  onPageChange,
}: {
  pagination: DashboardTimelineResponse['pagination'];
  onPageChange: (page: number) => void;
}) {
  const { page, totalPages, total } = pagination;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
      <p className="text-slate-600">
        {total} hợp đồng · trang {page}/{totalPages || 1}
      </p>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Trước
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Sau
        </Button>
      </div>
    </div>
  );
}
