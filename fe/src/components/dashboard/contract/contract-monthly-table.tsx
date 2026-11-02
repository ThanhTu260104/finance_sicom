'use client';

import type { DashboardCumulativeTrendPoint } from '@/lib/types';
import {
  formatCurrencyVND,
  formatPeriod,
  formatPercentDisplay,
} from '@/lib/format';
import { batchLabel, formatBatchDateRange } from '@/lib/plan-batch-period-map';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

/** Bảng số liệu theo tháng, hoặc theo đợt NT khi các dòng có `label` (HĐ chu kỳ > 1 tháng). */
export function ContractMonthlyTable({
  rows,
}: {
  rows: DashboardCumulativeTrendPoint[];
}) {
  const byBatch = rows.some((r) => r.label);
  const unit = byBatch ? 'đợt' : 'tháng';
  // Theo đợt: NT gom theo đợt đã chọn khi nghiệm thu; theo tháng: theo ngày NT / ngày thu
  const ntSuffix = byBatch ? '' : ' (ngày NT)';
  const thuSuffix = byBatch ? '' : ' (ngày thu)';

  if (rows.length === 0) {
    return <p className="text-sm text-slate-500">Chưa có dữ liệu theo {unit}.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{byBatch ? 'Đợt nghiệm thu' : 'Tháng'}</TableHead>
            <TableHead className="text-right">KH NT {unit}</TableHead>
            <TableHead className="text-right">NT thực tế {unit}{ntSuffix}</TableHead>
            <TableHead className="text-right">Chênh lệch {unit}</TableHead>
            <TableHead className="text-right">Thu {unit}{thuSuffix}</TableHead>
            <TableHead className="text-right">KH NT lũy kế</TableHead>
            <TableHead className="text-right">NT lũy kế{ntSuffix}</TableHead>
            <TableHead className="text-right">Chênh lệch lũy kế</TableHead>
            <TableHead className="text-right">Thu lũy kế{thuSuffix}</TableHead>
            <TableHead className="text-right">% NT {unit}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.period}>
              <TableCell className="font-medium">
                {row.label ?? formatPeriod(row.period)}
                {row.label ? (
                  <div className="text-xs font-normal text-slate-500">
                    {formatBatchDateRange(row.periodStartDate, row.periodEndDate)}
                  </div>
                ) : row.batchSequence != null ? (
                  <div className="text-xs font-normal text-slate-500">
                    {batchLabel(row.batchSequence)}
                  </div>
                ) : null}
              </TableCell>
              <TableCell className="text-right tabular-nums text-sm">
                {formatCurrencyVND(row.plannedAcceptance)}
              </TableCell>
              <TableCell className="text-right tabular-nums text-sm">
                {formatCurrencyVND(row.actualAcceptance)}
              </TableCell>
              <TableCell className="text-right tabular-nums text-sm">
                {formatCurrencyVND(row.acceptanceGapPeriod ?? row.acceptanceGap)}
              </TableCell>
              <TableCell className="text-right tabular-nums text-sm">
                {formatCurrencyVND(row.actualCollection)}
              </TableCell>
              <TableCell className="text-right tabular-nums text-sm">
                {formatCurrencyVND(row.plannedAcceptanceCumulative)}
              </TableCell>
              <TableCell className="text-right tabular-nums text-sm">
                {formatCurrencyVND(row.actualAcceptanceCumulative)}
              </TableCell>
              <TableCell className="text-right tabular-nums text-sm">
                {formatCurrencyVND(row.acceptanceGap)}
              </TableCell>
              <TableCell className="text-right tabular-nums text-sm">
                {formatCurrencyVND(row.actualCollectionCumulative)}
              </TableCell>
              <TableCell className="text-right tabular-nums text-sm">
                {formatPercentDisplay(row.acceptanceProgressPeriod)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
