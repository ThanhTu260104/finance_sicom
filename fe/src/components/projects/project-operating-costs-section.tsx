'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { costCategoriesApi, projectOperatingCostsApi } from '@/lib/api';
import {
  isValidAmount,
  isValidPeriod,
  normalizeAmount,
} from '@/lib/csv';
import { cn } from '@/lib/utils';
import { formatCurrencyVND } from '@/lib/format';
import { parseGroupedNumber } from '@/lib/number-format';
import { currentCalendarPeriod } from '@/lib/period';
import { parseCostAmount } from '@/lib/project-operating-cost-totals';
import {
  CsvDataTransfer,
  type CsvColumn,
} from '@/components/shared/csv-data-transfer';
import { ConfirmDeleteButton } from '@/components/shared/confirm-delete-button';
import type {
  CostCategory,
  OperatingCostTrendResponse,
  ProjectOperatingCost,
} from '@/lib/types';
import { ProjectOperatingCostsCharts } from '@/components/projects/project-operating-costs-charts';
import { formatPeriod } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MoneyInput } from '@/components/ui/money-input';
import { Select } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { WriteOnly } from '@/components/auth/auth-provider';

function buildCsvColumns(categories: CostCategory[]): readonly CsvColumn[] {
  return [
    {
      key: 'period',
      header: 'Ky',
      aliases: ['Kỳ', 'period'],
      required: true,
      sample: '2026-09',
      type: 'period',
    },
    {
      key: 'categoryCode',
      header: 'MaLoai',
      aliases: ['Mã loại', 'categoryCode', 'LoaiChiPhi'],
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
      sample: 'Phat sinh',
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
}

const emptyForm = (categoryId: string) => ({
  categoryId,
  title: '',
  amount: '',
  note: '',
});

export function ProjectOperatingCostsSection({
  projectId,
  projectCode,
}: {
  projectId: string;
  projectCode?: string;
}) {
  const [period, setPeriod] = useState(currentCalendarPeriod);
  const [categories, setCategories] = useState<CostCategory[]>([]);
  const [items, setItems] = useState<ProjectOperatingCost[]>([]);
  const [knownPeriods, setKnownPeriods] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm(''));
  const [saving, setSaving] = useState(false);
  const [trend, setTrend] = useState<OperatingCostTrendResponse | null>(null);
  const [showLineDetail, setShowLineDetail] = useState(true);

  const loadCategories = useCallback(async () => {
    try {
      const data = await costCategoriesApi.listAll({ status: 'ACTIVE' });
      setCategories(data);
      return data;
    } catch {
      toast.error('Không tải được loại chi phí');
      return [];
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const year = Number(period.slice(0, 4));
      const [rows, periods, trendData] = await Promise.all([
        projectOperatingCostsApi.list(projectId, { period }),
        projectOperatingCostsApi.listPeriods(projectId),
        Number.isFinite(year)
          ? projectOperatingCostsApi.trend(projectId, { year })
          : Promise.resolve(null),
      ]);
      setItems(rows);
      setKnownPeriods(periods);
      if (trendData) setTrend(trendData);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Không tải chi phí');
    } finally {
      setLoading(false);
    }
  }, [projectId, period]);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (categories.length && !form.categoryId) {
      setForm((f) => ({ ...f, categoryId: categories[0].id }));
    }
  }, [categories, form.categoryId]);

  const csvColumns = useMemo(
    () => buildCsvColumns(categories),
    [categories],
  );

  const categoryByCode = useMemo(() => {
    const m = new Map<string, CostCategory>();
    for (const c of categories) m.set(c.code.toUpperCase(), c);
    return m;
  }, [categories]);

  const monthTotal = useMemo(
    () => items.reduce((s, r) => s + parseCostAmount(r.amount), 0),
    [items],
  );

  const trendPoints = trend?.points ?? [];

  const { prevMonthTotal, yearTotal } = useMemo(() => {
    const year = period.slice(0, 4);
    const monthIdx = Number(period.slice(5, 7)) - 1;
    const byPeriod = new Map(
      trendPoints.map((p) => [p.period, Number(p.total)]),
    );
    let yTotal = 0;
    for (let m = 1; m <= 12; m++) {
      const key = `${year}-${String(m).padStart(2, '0')}`;
      yTotal += byPeriod.get(key) ?? 0;
    }
    const prevKey =
      monthIdx > 0
        ? `${year}-${String(monthIdx).padStart(2, '0')}`
        : null;
    const prev =
      prevKey != null ? (byPeriod.get(prevKey) ?? 0) : null;
    return {
      prevMonthTotal: prev,
      yearTotal: yTotal,
    };
  }, [trendPoints, period]);

  const itemsByCategory = useMemo(() => {
    const groups = new Map<
      string,
      { name: string; code: string; rows: ProjectOperatingCost[]; subtotal: number }
    >();
    for (const row of items) {
      const key = row.categoryId;
      let g = groups.get(key);
      if (!g) {
        g = {
          name: row.category?.name ?? '—',
          code: row.category?.code ?? '',
          rows: [],
          subtotal: 0,
        };
        groups.set(key, g);
      }
      g.rows.push(row);
      g.subtotal += parseCostAmount(row.amount);
    }
    return Array.from(groups.values()).sort((a, b) => b.subtotal - a.subtotal);
  }, [items]);

  const sortedKnownPeriods = useMemo(
    () => [...knownPeriods].sort().reverse(),
    [knownPeriods],
  );

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm(categories[0]?.id ?? ''));
    setShowForm(true);
  };

  const openEdit = (row: ProjectOperatingCost) => {
    setEditingId(row.id);
    setForm({
      categoryId: row.categoryId,
      title: row.title ?? '',
      amount: String(parseCostAmount(row.amount)),
      note: row.note ?? '',
    });
    setShowForm(true);
  };

  const handleSaveLine = async () => {
    if (!form.categoryId) {
      toast.error('Chọn loại chi phí');
      return;
    }
    const amountRaw = form.amount.trim();
    if (!amountRaw || !isValidAmount(amountRaw)) {
      toast.error('Nhập số tiền hợp lệ');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        period,
        categoryId: form.categoryId,
        title: form.title.trim() || undefined,
        amount: Number(parseGroupedNumber(amountRaw)),
        note: form.note.trim() || undefined,
      };
      if (editingId) {
        await projectOperatingCostsApi.update(editingId, payload);
        toast.success('Đã cập nhật dòng chi phí');
      } else {
        await projectOperatingCostsApi.create(projectId, payload);
        toast.success('Đã thêm chi phí');
      }
      setShowForm(false);
      setEditingId(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Lưu thất bại');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await projectOperatingCostsApi.remove(id);
      toast.success('Đã xóa dòng chi phí');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Xóa thất bại');
    }
  };

  const handleImportCsv = async (rows: Array<Record<string, string>>) => {
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
    await load();
  };

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="text-base">Chi phí dự án</CardTitle>
          <p className="mt-1 text-xs text-slate-500">
            Tổng quan biểu đồ + bảng theo loại. Danh mục:{' '}
            <Link href="/cost-categories" className="underline">
              loại chi phí
            </Link>
            .
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Kỳ (tháng)</Label>
            <Input
              type="month"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="w-[160px]"
            />
          </div>
          {categories.length > 0 && (
            <CsvDataTransfer
              title="chi phí dự án"
              filenamePrefix={
                projectCode
                  ? `chi-phi-${projectCode.replace(/[^\w-]+/g, '_')}`
                  : 'chi-phi-du-an'
              }
              columns={csvColumns}
              sampleRows={[
                {
                  period,
                  categoryCode: categories[0]?.code ?? '',
                  title: 'Phat sinh',
                  amount: '500000',
                  note: '',
                },
              ]}
              exportRows={items.map((row) => ({
                period: row.period,
                categoryCode: row.category?.code ?? '',
                title: row.title ?? '',
                amount: String(parseCostAmount(row.amount)),
                note: row.note ?? '',
              }))}
              validateRow={(row) => {
                const errors: string[] = [];
                if (!row.period?.trim() || !isValidPeriod(row.period)) {
                  errors.push('Kỳ: YYYY-MM');
                }
                const code = row.categoryCode?.trim().toUpperCase();
                if (!code) errors.push('Thiếu mã loại');
                else if (!categoryByCode.has(code)) {
                  errors.push('Mã loại không có trong danh mục đang dùng');
                }
                if (!row.amount?.trim() || !isValidAmount(row.amount)) {
                  errors.push('Số tiền không hợp lệ');
                }
                return errors;
              }}
              onImport={handleImportCsv}
              className="shrink-0"
            />
          )}
          <WriteOnly>
            <Button size="sm" onClick={openCreate} disabled={!categories.length}>
              <Plus className="h-4 w-4" />
              Thêm chi phí
            </Button>
          </WriteOnly>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {!loading && (
          <ProjectOperatingCostsCharts
            trendPoints={trendPoints}
            selectedPeriod={period}
            onSelectPeriod={setPeriod}
            monthItems={items}
            monthTotal={monthTotal}
            prevMonthTotal={prevMonthTotal}
            yearTotal={yearTotal}
          />
        )}

        {sortedKnownPeriods.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-slate-600">
              Chọn nhanh:
            </span>
            {sortedKnownPeriods.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                  p === period
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
                )}
              >
                {formatPeriod(p)}
              </button>
            ))}
          </div>
        )}

        {categories.length === 0 && !loading && (
          <p className="text-sm text-amber-800">
            Chưa có loại chi phí đang dùng.{' '}
            <Link href="/cost-categories" className="underline">
              Thêm loại chi phí
            </Link>{' '}
            trước.
          </p>
        )}

        {showForm && (
          <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50/80 p-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label>Loại chi phí</Label>
              <Select
                value={form.categoryId}
                onChange={(e) =>
                  setForm((f) => ({ ...f, categoryId: e.target.value }))
                }
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} — {c.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Số tiền (VND)</Label>
              <MoneyInput
                value={form.amount}
                onChange={(v) => setForm((f) => ({ ...f, amount: v }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Mô tả thêm</Label>
              <Input
                value={form.title}
                onChange={(e) =>
                  setForm((f) => ({ ...f, title: e.target.value }))
                }
                placeholder="Tuỳ chọn"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Ghi chú</Label>
              <Input
                value={form.note}
                onChange={(e) =>
                  setForm((f) => ({ ...f, note: e.target.value }))
                }
              />
            </div>
            <div className="flex gap-2 md:col-span-2">
              <Button onClick={() => void handleSaveLine()} disabled={saving}>
                {saving ? 'Đang lưu...' : editingId ? 'Cập nhật' : 'Lưu dòng'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowForm(false);
                  setEditingId(null);
                }}
              >
                Hủy
              </Button>
            </div>
          </div>
        )}

        {loading ? (
          <p className="text-sm text-slate-500">Đang tải...</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-slate-500">
            Chưa có chi phí tháng {formatPeriod(period)}.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>Loại chi phí</TableHead>
                    <TableHead className="text-right">Số dòng</TableHead>
                    <TableHead className="text-right">Tổng</TableHead>
                    <TableHead className="text-right">% tháng</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itemsByCategory.map((g) => (
                    <TableRow key={g.code + g.name}>
                      <TableCell>
                        <span className="font-medium text-slate-900">
                          {g.name}
                        </span>
                        {g.code ? (
                          <span className="ml-2 font-mono text-[10px] text-slate-400">
                            {g.code}
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {g.rows.length}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {formatCurrencyVND(g.subtotal)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-slate-600">
                        {monthTotal > 0
                          ? `${((g.subtotal / monthTotal) * 100).toFixed(1)}%`
                          : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-teal-50/60 font-semibold">
                    <TableCell>Tổng {formatPeriod(period)}</TableCell>
                    <TableCell className="text-right">{items.length}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrencyVND(monthTotal)}
                    </TableCell>
                    <TableCell className="text-right">100%</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            <div>
              <button
                type="button"
                className="text-sm font-medium text-teal-800 underline-offset-2 hover:underline"
                onClick={() => setShowLineDetail((v) => !v)}
              >
                {showLineDetail ? 'Ẩn' : 'Hiện'} chi tiết từng dòng (
                {items.length})
              </button>
            </div>

            {showLineDetail && (
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Loại</TableHead>
                      <TableHead>Mô tả</TableHead>
                      <TableHead className="text-right">Số tiền</TableHead>
                      <TableHead>Ghi chú</TableHead>
                      <TableHead className="text-right">Thao tác</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {itemsByCategory.map((g) => (
                      <Fragment key={g.code || g.name}>
                        <TableRow className="bg-slate-50/90">
                          <TableCell
                            colSpan={5}
                            className="py-2 text-xs font-semibold uppercase tracking-wide text-slate-600"
                          >
                            {g.name}
                            {g.code ? ` · ${g.code}` : ''} —{' '}
                            {formatCurrencyVND(g.subtotal)}
                          </TableCell>
                        </TableRow>
                        {g.rows.map((row) => (
                          <TableRow key={row.id}>
                            <TableCell className="text-slate-400">·</TableCell>
                            <TableCell>{row.title || '—'}</TableCell>
                            <TableCell className="text-right font-medium tabular-nums">
                              {formatCurrencyVND(parseCostAmount(row.amount))}
                            </TableCell>
                            <TableCell className="max-w-[180px] truncate">
                              {row.note || '—'}
                            </TableCell>
                            <TableCell>
                              <div className="flex justify-end gap-2">
                                <WriteOnly>
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    onClick={() => openEdit(row)}
                                  >
                                    Sửa
                                  </Button>
                                </WriteOnly>
                                <ConfirmDeleteButton
                                  onConfirm={() => handleDelete(row.id)}
                                  title="Xóa dòng chi phí?"
                                  description="Xóa vĩnh viễn dòng này khỏi tháng."
                                />
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </Fragment>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
