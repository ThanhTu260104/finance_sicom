'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { projectsApi } from '@/lib/api';
import type { ProjectContractCosts } from '@/lib/types';
import { formatCurrencyVND, formatPeriod } from '@/lib/format';
import { partnerTypeLabel } from '@/lib/contract-kind';
import { Select } from '@/components/ui/select';
import { CollapsibleTableCard } from '@/components/shared/collapsible-table-card';
import { QueryState } from '@/components/shared/query-state';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const ALL_YEARS = 'all';

/**
 * Chi phí thầu phụ và nhà cung cấp — tổng tiền đã chi trên các HĐ chi của dự án,
 * tách riêng 2 nhóm. Nguồn: đợt nghiệm thu đánh dấu "Đã chi trả" (tự sinh bản ghi chi).
 */
export function ProjectContractCostsSection({ projectId }: { projectId: string }) {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState<string>(String(currentYear));
  const [data, setData] = useState<ProjectContractCosts | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(
        await projectsApi.getContractCosts(
          projectId,
          year === ALL_YEARS ? {} : { year: Number(year) },
        ),
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Không tải được chi phí thầu phụ / NCC',
      );
    } finally {
      setLoading(false);
    }
  }, [projectId, year]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const yearOptions = Array.from({ length: 6 }, (_, i) => currentYear + 1 - i);

  return (
    <CollapsibleTableCard
      title="Chi phí thầu phụ & nhà cung cấp"
      description="Tổng tiền đã chi trên HĐ thầu phụ / NCC của dự án — đợt nghiệm thu đánh dấu Đã chi trả, tính theo kỳ nghiệm thu"
    >
      <div className="mb-3 flex items-center gap-2">
        <span className="text-sm text-slate-600">Năm</span>
        <Select
          className="w-40"
          value={year}
          onChange={(e) => setYear(e.target.value)}
        >
          {yearOptions.map((y) => (
            <option key={y} value={String(y)}>
              {y}
            </option>
          ))}
          <option value={ALL_YEARS}>Tất cả</option>
        </Select>
      </div>
      <QueryState
        loading={loading}
        error={error}
        empty={!data || data.contracts.length === 0}
        emptyMessage="Dự án chưa có HĐ thầu phụ / nhà cung cấp."
        onRetry={load}
      >
        {data ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <CostTile
                label="Chi phí thầu phụ"
                value={data.totals.subcontractor}
              />
              <CostTile label="Chi phí nhà cung cấp" value={data.totals.supplier} />
              <CostTile label="Tổng" value={data.totals.total} strong />
            </div>

            {data.points.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Kỳ</TableHead>
                      <TableHead className="text-right">Thầu phụ</TableHead>
                      <TableHead className="text-right">Nhà cung cấp</TableHead>
                      <TableHead className="text-right">Tổng</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.points.map((p) => (
                      <TableRow key={p.period}>
                        <TableCell>{formatPeriod(p.period)}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCurrencyVND(p.subcontractor)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCurrencyVND(p.supplier)}
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {formatCurrencyVND(p.total)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-sm text-slate-500">
                Chưa có khoản chi nào trong kỳ đã chọn.
              </p>
            )}

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Số HĐ</TableHead>
                    <TableHead>Nhóm</TableHead>
                    <TableHead>Đối tác</TableHead>
                    <TableHead>Công ty</TableHead>
                    <TableHead className="text-right">Giá trị HĐ</TableHead>
                    <TableHead className="text-right">Đã chi (kỳ lọc)</TableHead>
                    <TableHead className="text-right">Đã chi lũy kế</TableHead>
                    <TableHead className="text-right">Còn phải trả</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.contracts.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">
                        <Link
                          href={`/contracts/${c.id}`}
                          className="underline-offset-2 hover:underline"
                        >
                          {c.contractNo}
                        </Link>
                      </TableCell>
                      <TableCell>{partnerTypeLabel[c.kind]}</TableCell>
                      <TableCell>
                        {c.counterparty
                          ? `${c.counterparty.code} — ${c.counterparty.name}`
                          : '—'}
                      </TableCell>
                      <TableCell>{c.company?.code ?? '—'}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrencyVND(c.contractValue)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrencyVND(c.paid)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrencyVND(c.paidToDate)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrencyVND(c.remaining)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        ) : null}
      </QueryState>
    </CollapsibleTableCard>
  );
}

function CostTile({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p
        className={
          strong
            ? 'mt-1 text-lg font-semibold tabular-nums text-slate-900'
            : 'mt-1 text-lg tabular-nums text-slate-800'
        }
      >
        {formatCurrencyVND(value)}
      </p>
    </div>
  );
}
