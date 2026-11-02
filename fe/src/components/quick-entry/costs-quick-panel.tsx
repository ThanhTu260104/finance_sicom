'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { costCategoriesApi, projectOperatingCostsApi } from '@/lib/api';
import {
  isValidAmount,
  isValidPeriod,
  normalizeAmount,
} from '@/lib/csv';
import { formatCurrencyVND, formatPeriod } from '@/lib/format';
import { currentCalendarPeriod } from '@/lib/period';
import type { CostCategory, ProjectOperatingCost } from '@/lib/types';
import { CsvDataTransfer, type CsvColumn } from '@/components/shared/csv-data-transfer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MoneyInput } from '@/components/ui/money-input';
import { Select } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export function CostsQuickPanel({
  projectId,
  projectCode,
}: {
  projectId: string;
  projectCode?: string;
}) {
  const [period, setPeriod] = useState(currentCalendarPeriod);
  const [categories, setCategories] = useState<CostCategory[]>([]);
  const [categoryId, setCategoryId] = useState('');
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const [recent, setRecent] = useState<ProjectOperatingCost[]>([]);

  const csvColumns = useMemo((): readonly CsvColumn[] => {
    return [
      {
        key: 'period',
        header: 'Ky',
        aliases: ['Kỳ', 'period'],
        required: true,
        sample: period,
        type: 'period' as const,
      },
      {
        key: 'categoryCode',
        header: 'MaLoai',
        aliases: ['Mã loại', 'categoryCode'],
        required: true,
        sample: categories[0]?.code ?? 'OPERATING',
        type: 'select',
        options: categories.map((c) => ({
          value: c.code,
          label: `${c.code} — ${c.name}`,
        })),
      },
      {
        key: 'title',
        header: 'MoTa',
        aliases: ['Mô tả', 'title'],
        sample: 'Phát sinh',
      },
      {
        key: 'amount',
        header: 'SoTien',
        aliases: ['Số tiền', 'amount'],
        required: true,
        sample: '1000000',
        type: 'money',
      },
      { key: 'note', header: 'GhiChu', aliases: ['note'], sample: '' },
    ];
  }, [categories, period]);

  const categoryByCode = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of categories) {
      m.set(c.code.toUpperCase(), c.id);
    }
    return m;
  }, [categories]);

  const loadCategories = useCallback(async () => {
    const data = await costCategoriesApi.listAll({ status: 'ACTIVE' });
    setCategories(data);
    if (data[0] && !categoryId) setCategoryId(data[0].id);
  }, [categoryId]);

  const loadRecent = useCallback(async () => {
    try {
      const rows = await projectOperatingCostsApi.list(projectId, { period });
      setRecent(rows.slice(0, 8));
    } catch {
      setRecent([]);
    }
  }, [projectId, period]);

  useEffect(() => {
    loadCategories().catch(() => toast.error('Không tải loại chi phí'));
  }, [loadCategories]);

  useEffect(() => {
    loadRecent();
  }, [loadRecent]);

  const handleSave = async (andContinue: boolean) => {
    if (!categoryId) {
      toast.error('Chọn loại chi phí');
      return;
    }
    if (!isValidPeriod(period) || !isValidAmount(amount)) {
      toast.error('Kiểm tra kỳ và số tiền');
      return;
    }
    setSaving(true);
    try {
      await projectOperatingCostsApi.create(projectId, {
        period,
        categoryId,
        title: title.trim() || undefined,
        amount: Number(normalizeAmount(amount)),
      });
      toast.success('Đã lưu chi phí');
      await loadRecent();
      if (andContinue) {
        setTitle('');
        setAmount('');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Lưu thất bại');
    } finally {
      setSaving(false);
    }
  };

  const handleImport = async (rows: Array<Record<string, string>>) => {
    await projectOperatingCostsApi.bulkCreate(
      projectId,
      rows.map((row) => ({
        period: row.period.trim(),
        categoryCode: row.categoryCode.trim(),
        title: row.title?.trim() || undefined,
        amount: Number(normalizeAmount(row.amount)),
        note: row.note?.trim() || undefined,
      })),
    );
    toast.success(`Đã import ${rows.length} dòng chi phí`);
    await loadRecent();
  };

  if (!categories.length) {
    return (
      <p className="text-sm text-amber-800">
        Chưa có loại chi phí.{' '}
        <Link href="/cost-categories" className="underline">
          Thêm loại chi phí
        </Link>{' '}
        trước khi nhập.
      </p>
    );
  }

  const prefix =
    projectCode?.replace(/[^\w-]+/g, '_') ?? projectId.slice(0, 8);

  return (
    <div className="space-y-6">
      <p className="text-xs text-slate-500">
        Chi phí gắn dự án (kỳ YYYY-MM). Hợp đồng đã chọn thuộc dự án này.
      </p>
      <div className="grid gap-4 rounded-lg border border-slate-200 bg-slate-50/60 p-4 md:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1">
          <Label className="text-xs">Kỳ (tháng)</Label>
          <Input
            type="month"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          />
        </div>
        <div className="space-y-1 md:col-span-2">
          <Label className="text-xs">Loại chi phí</Label>
          <Select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} — {c.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1 md:col-span-2">
          <Label className="text-xs">Mô tả (tuỳ chọn)</Label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Phát sinh tháng này"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Số tiền</Label>
          <MoneyInput value={amount} onChange={setAmount} />
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
            title="chi phí dự án"
            filenamePrefix={`chi-phi-${prefix}`}
            columns={csvColumns}
            sampleRows={[
              {
                period,
                categoryCode: categories[0]?.code ?? '',
                title: 'Phat sinh',
                amount: '500000',
              },
            ]}
            exportRows={recent.map((r) => ({
              period: r.period,
              categoryCode: r.category?.code ?? '',
              title: r.title ?? '',
              amount: String(r.amount),
              note: r.note ?? '',
            }))}
            validateRow={(row) => {
              const errors: string[] = [];
              if (!isValidPeriod(row.period ?? '')) errors.push('Kỳ YYYY-MM');
              const code = row.categoryCode?.trim().toUpperCase();
              if (!code || !categoryByCode.has(code)) {
                errors.push('Mã loại');
              }
              if (!isValidAmount(row.amount ?? '')) errors.push('Số tiền');
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
              <TableHead>Loại</TableHead>
              <TableHead className="text-right">Số tiền</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {recent.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{formatPeriod(r.period)}</TableCell>
                <TableCell>{r.category?.code ?? '—'}</TableCell>
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
