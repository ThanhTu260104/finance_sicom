'use client';

import { useCallback, useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { acceptancesApi, contractsApi } from '@/lib/api';
import type { Contract } from '@/lib/types';
import { ACCEPTANCES_BULK_EXPORT_COLUMNS } from '@/lib/quick-entry/acceptances-export-columns';
import {
  downloadExcel,
  type CsvColumn,
} from '@/components/shared/csv-data-transfer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const CONCURRENCY = 8;

function excelHeader(col: CsvColumn) {
  return col.required ? `${col.header} (*)` : col.header;
}

async function fetchAllContracts() {
  const limit = 100;
  const all: Contract[] = [];
  let page = 1;
  let totalPages = 1;
  while (page <= totalPages) {
    const res = await contractsApi.list({
      page,
      limit,
      sortBy: 'contractNo',
      sortOrder: 'asc',
    });
    all.push(...res.data);
    totalPages = res.meta.totalPages;
    page += 1;
  }
  return all;
}

async function mapInBatches<T, R>(
  items: T[],
  batchSize: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const chunk = items.slice(i, i + batchSize);
    const part = await Promise.all(chunk.map(fn));
    results.push(...part);
  }
  return results;
}

export function AcceptancesBulkExport() {
  const [loading, setLoading] = useState(false);
  const [lastStats, setLastStats] = useState<{
    contracts: number;
    rows: number;
  } | null>(null);

  const handleExport = useCallback(async () => {
    setLoading(true);
    setLastStats(null);
    try {
      const contracts = await fetchAllContracts();
      if (!contracts.length) {
        toast.error('Không có hợp đồng để xuất');
        return;
      }

      const pairs = await mapInBatches(contracts, CONCURRENCY, async (contract) => {
          try {
            const acceptances = await acceptancesApi.list(contract.id);
            return acceptances.map((a) => ({
              contractNo: contract.contractNo,
              projectCode: contract.project?.code ?? '',
              contractName: contract.name,
              acceptanceNo: a.acceptanceNo,
              period: a.period,
              amount: String(a.amount),
              acceptanceDate: a.acceptanceDate?.slice(0, 10) ?? '',
              invoiceNo: a.invoiceNo ?? '',
              invoiceDate: a.invoiceDate?.slice(0, 10) ?? '',
              documentStatus: a.documentStatus,
              paymentStatus: a.paymentStatus,
              note: a.note ?? '',
            }));
          } catch {
            return [];
          }
      });

      const exportRows = pairs.flat();
      if (exportRows.length === 0) {
        toast.error('Chưa có nghiệm thu trên bất kỳ hợp đồng nào');
        return;
      }

      exportRows.sort((a, b) => {
        const c = a.contractNo.localeCompare(b.contractNo, 'vi');
        if (c !== 0) return c;
        return a.period.localeCompare(b.period) || a.acceptanceNo.localeCompare(b.acceptanceNo, 'vi');
      });

      const columns = ACCEPTANCES_BULK_EXPORT_COLUMNS;
      const stamp = new Date().toISOString().slice(0, 10);
      downloadExcel(
        `nghiem-thu-tat-ca-hd-${stamp}.xlsx`,
        columns.map(excelHeader),
        exportRows.map((row) => columns.map((c) => row[c.key as keyof typeof row] ?? '')),
      );

      setLastStats({ contracts: contracts.length, rows: exportRows.length });
      toast.success(
        `Đã xuất ${exportRows.length} dòng NT từ ${contracts.length} hợp đồng`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Xuất thất bại');
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Xuất nghiệm thu tất cả hợp đồng</CardTitle>
        <p className="text-sm font-normal text-slate-600">
          Tải một file Excel gộp mọi dòng nghiệm thu đang có (theo Số HĐ, Mã dự
          án, kỳ, tiền, trạng thái hồ sơ / thu tiền). Dùng để đối chiếu hoặc sao
          lưu trước khi import lại.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button type="button" disabled={loading} onClick={() => void handleExport()}>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          {loading ? 'Đang gom dữ liệu…' : 'Tải Excel nghiệm thu (tất cả HĐ)'}
        </Button>
        {lastStats ? (
          <p className="text-xs text-slate-500">
            Lần xuất gần nhất: {lastStats.rows} dòng NT · quét{' '}
            {lastStats.contracts} hợp đồng
          </p>
        ) : null}
        <p className="text-xs text-slate-500">
          Cột: Số HĐ, Mã dự án, Tên HĐ, mã NT, kỳ, số tiền, ngày NT/HĐ, hồ sơ,
          thanh toán, ghi chú.
        </p>
      </CardContent>
    </Card>
  );
}
