'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { collectionsApi } from '@/lib/api';
import {
  isValidAmount,
  isValidOptionalDate,
  isValidPeriod,
  normalizeAmount,
} from '@/lib/csv';
import { formatCurrencyVND, formatPeriod } from '@/lib/format';
import { currentCalendarPeriod } from '@/lib/period';
import { QUICK_COLLECTION_COLUMNS } from '@/lib/quick-entry/csv-columns';
import type { Collection } from '@/lib/types';
import { CsvDataTransfer } from '@/components/shared/csv-data-transfer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MoneyInput } from '@/components/ui/money-input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export function CollectionsQuickPanel({
  contractId,
  contractNo,
}: {
  contractId: string;
  contractNo: string;
}) {
  const [period, setPeriod] = useState(currentCalendarPeriod);
  const [collectionNo, setCollectionNo] = useState('');
  const [amount, setAmount] = useState('');
  const [collectionDate, setCollectionDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [recent, setRecent] = useState<Collection[]>([]);

  const loadRecent = useCallback(async () => {
    try {
      const rows = await collectionsApi.list(contractId);
      setRecent(rows.slice(0, 8));
    } catch {
      setRecent([]);
    }
  }, [contractId]);

  useEffect(() => {
    loadRecent();
  }, [loadRecent]);

  const handleSave = async (andContinue: boolean) => {
    if (!collectionNo.trim()) {
      toast.error('Nhập số chứng từ');
      return;
    }
    if (!isValidPeriod(period) || !isValidAmount(amount)) {
      toast.error('Kiểm tra kỳ và số tiền');
      return;
    }
    setSaving(true);
    try {
      await collectionsApi.create(contractId, {
        collectionNo: collectionNo.trim(),
        period,
        amount: Number(normalizeAmount(amount)),
        collectionDate: collectionDate.trim() || undefined,
      });
      toast.success('Đã lưu thu tiền');
      await loadRecent();
      if (andContinue) {
        setCollectionNo('');
        setAmount('');
        setCollectionDate('');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Lưu thất bại');
    } finally {
      setSaving(false);
    }
  };

  const handleImport = async (rows: Array<Record<string, string>>) => {
    await collectionsApi.bulkUpsert(
      contractId,
      rows.map((row) => ({
        collectionNo: row.collectionNo.trim(),
        period: row.period.trim(),
        amount: Number(normalizeAmount(row.amount)),
        collectionDate: row.collectionDate?.trim() || undefined,
        note: row.note?.trim() || undefined,
      })),
    );
    toast.success(`Đã import ${rows.length} dòng thu tiền`);
    await loadRecent();
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 rounded-lg border border-slate-200 bg-slate-50/60 p-4 md:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1">
          <Label className="text-xs">Kỳ (tháng)</Label>
          <Input
            type="month"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Số chứng từ</Label>
          <Input
            value={collectionNo}
            onChange={(e) => setCollectionNo(e.target.value)}
            placeholder="TT-01/2026"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Số tiền</Label>
          <MoneyInput value={amount} onChange={setAmount} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Ngày thu (tuỳ chọn)</Label>
          <Input
            type="date"
            value={collectionDate}
            onChange={(e) => setCollectionDate(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap items-end gap-2 md:col-span-3">
          <Button size="sm" disabled={saving} onClick={() => handleSave(true)}>
            Lưu &amp; thêm tiếp
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={saving}
            onClick={() => handleSave(false)}
          >
            Lưu
          </Button>
          <CsvDataTransfer
            title="thu tiền"
            filenamePrefix={`thu-tien-${contractNo.replace(/[^\w-]+/g, '_')}`}
            columns={QUICK_COLLECTION_COLUMNS}
            sampleRows={[
              {
                collectionNo: 'TT-01/2026',
                period,
                amount: '500000000',
                collectionDate: '',
              },
            ]}
            exportRows={recent.map((r) => ({
              collectionNo: r.collectionNo,
              period: r.period,
              amount: String(r.amount),
              collectionDate: r.collectionDate?.slice(0, 10) ?? '',
              note: r.note ?? '',
            }))}
            validateRow={(row) => {
              const errors: string[] = [];
              if (!row.collectionNo?.trim()) errors.push('Thiếu chứng từ');
              if (!isValidPeriod(row.period ?? '')) errors.push('Kỳ YYYY-MM');
              if (!isValidAmount(row.amount ?? '')) errors.push('Số tiền');
              if (!isValidOptionalDate(row.collectionDate ?? '')) {
                errors.push('Ngày thu YYYY-MM-DD');
              }
              return errors;
            }}
            onImport={handleImport}
          />
        </div>
      </div>

      {recent.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kỳ</TableHead>
              <TableHead>Chứng từ</TableHead>
              <TableHead className="text-right">Số tiền</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {recent.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{formatPeriod(r.period)}</TableCell>
                <TableCell>{r.collectionNo}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCurrencyVND(r.amount)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
