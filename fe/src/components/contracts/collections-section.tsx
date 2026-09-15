'use client';

import { useCallback, useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { collectionsApi } from '@/lib/api';
import { formatCurrencyVND, formatDate, formatPeriod } from '@/lib/format';
import {
  isValidAmount,
  isValidOptionalDate,
  isValidPeriod,
  normalizeAmount,
} from '@/lib/csv';
import type { Collection } from '@/lib/types';
import { ConfirmDeleteButton } from '@/components/shared/confirm-delete-button';
import {
  buildPeriodOptions,
  CsvDataTransfer,
} from '@/components/shared/csv-data-transfer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MoneyInput } from '@/components/ui/money-input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { QueryState } from '@/components/shared/query-state';

const PERIOD_OPTIONS = buildPeriodOptions();

const COLLECTION_CSV_COLUMNS = [
  {
    key: 'collectionNo',
    header: 'SoChungTu',
    aliases: ['collectionNo', 'Số chứng từ', 'so chung tu'],
    required: true,
    sample: 'TT-01/2026',
  },
  {
    key: 'period',
    header: 'Ky',
    aliases: ['period', 'Kỳ', 'ky'],
    required: true,
    sample: '2026-01',
    type: 'period' as const,
    options: PERIOD_OPTIONS,
  },
  {
    key: 'amount',
    header: 'SoTien',
    aliases: ['amount', 'Số tiền', 'so tien'],
    required: true,
    sample: '500000000',
    type: 'money' as const,
  },
  {
    key: 'collectionDate',
    header: 'NgayThu',
    aliases: ['collectionDate', 'Ngày thu', 'ngay thu'],
    sample: '2026-02-15',
    type: 'date' as const,
  },
  {
    key: 'note',
    header: 'GhiChu',
    aliases: ['note', 'Ghi chú', 'ghi chu'],
    sample: 'Thu đợt 1',
  },
];

const schema = z.object({
  collectionNo: z.string().min(1, 'Bắt buộc'),
  period: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Kỳ phải dạng YYYY-MM'),
  amount: z
    .string()
    .min(1, 'Bắt buộc')
    .refine((v) => !Number.isNaN(Number(v)) && Number(v) >= 0, {
      message: 'Số tiền ≥ 0',
    })
    .refine((v) => /^\d+(\.\d{1,2})?$/.test(v), {
      message: 'Tối đa 2 chữ số thập phân',
    }),
  collectionDate: z.string().optional(),
  note: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export function CollectionsSection({
  contractId,
  onChanged,
}: {
  contractId: string;
  onChanged?: () => void;
}) {
  const [items, setItems] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Collection | null>(null);
  const [showForm, setShowForm] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      collectionNo: '',
      period: '',
      amount: '',
      collectionDate: '',
      note: '',
    },
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await collectionsApi.list(contractId);
      setItems(data);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Không tải được thu tiền';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [contractId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    reset({
      collectionNo: '',
      period: '',
      amount: '',
      collectionDate: '',
      note: '',
    });
    setShowForm(true);
  };

  const openEdit = (item: Collection) => {
    setEditing(item);
    reset({
      collectionNo: item.collectionNo,
      period: item.period,
      amount: String(item.amount),
      collectionDate: item.collectionDate?.slice(0, 10) ?? '',
      note: item.note ?? '',
    });
    setShowForm(true);
  };

  const onSubmit = async (values: FormValues) => {
    try {
      const payload = {
        collectionNo: values.collectionNo,
        period: values.period,
        amount: Number(values.amount),
        collectionDate: values.collectionDate || undefined,
        note: values.note || undefined,
      };

      if (editing) {
        await collectionsApi.update(editing.id, payload);
        toast.success('Đã cập nhật thu tiền');
      } else {
        await collectionsApi.create(contractId, payload);
        toast.success('Đã thêm thu tiền');
      }

      setShowForm(false);
      setEditing(null);
      load();
      onChanged?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Lưu thất bại');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await collectionsApi.remove(id);
      toast.success('Đã xóa thu tiền');
      load();
      onChanged?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Xóa thất bại');
    }
  };

  const handleImportCsv = async (rows: Array<Record<string, string>>) => {
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
    await load();
    onChanged?.();
  };

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="text-base">Thu tiền</CardTitle>
          <p className="mt-1 text-xs text-slate-500">
            Tiền về thực tế. Khi thêm/sửa/xóa sẽ tự cập nhật trạng thái thu
            trên các đợt nghiệm thu cùng kỳ.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CsvDataTransfer
            title="thu tiền"
            filenamePrefix={`thu-tien-${contractId.slice(0, 8)}`}
            columns={COLLECTION_CSV_COLUMNS}
            sampleRows={[
              {
                collectionNo: 'TT-01/2026',
                period: '2026-01',
                amount: '500000000',
                collectionDate: '2026-02-15',
                note: 'Thu đợt 1',
              },
              {
                collectionNo: 'TT-02/2026',
                period: '2026-02',
                amount: '450000000',
                collectionDate: '2026-03-20',
                note: 'Thu đợt 2',
              },
            ]}
            exportRows={items.map((item) => ({
              collectionNo: item.collectionNo,
              period: item.period,
              amount: String(item.amount),
              collectionDate: item.collectionDate?.slice(0, 10) ?? '',
              note: item.note ?? '',
            }))}
            validateRow={(row) => {
              const errors: string[] = [];
              if (!row.collectionNo?.trim()) errors.push('Thiếu số chứng từ');
              if (!isValidPeriod(row.period ?? '')) {
                errors.push('Kỳ phải dạng YYYY-MM');
              }
              if (!isValidAmount(row.amount ?? '')) {
                errors.push('Số tiền không hợp lệ');
              }
              if (!isValidOptionalDate(row.collectionDate ?? '')) {
                errors.push('Ngày thu phải dạng YYYY-MM-DD');
              }
              return errors;
            }}
            onImport={handleImportCsv}
          />
          <Button size="sm" onClick={openCreate}>
            Thêm thu tiền
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {showForm ? (
          <form onSubmit={handleSubmit(onSubmit)} className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <Label>Số chứng từ</Label>
              <Input {...register('collectionNo')} />
              {errors.collectionNo ? (
                <p className="text-xs text-red-600">{errors.collectionNo.message}</p>
              ) : null}
            </div>
            <div className="space-y-1">
              <Label>Kỳ (YYYY-MM)</Label>
              <Input {...register('period')} />
              {errors.period ? (
                <p className="text-xs text-red-600">{errors.period.message}</p>
              ) : null}
            </div>
            <div className="space-y-1">
              <Label>Số tiền</Label>
              <Controller
                name="amount"
                control={control}
                render={({ field }) => (
                  <MoneyInput
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                  />
                )}
              />
              {errors.amount ? (
                <p className="text-xs text-red-600">{errors.amount.message}</p>
              ) : null}
            </div>
            <div className="space-y-1">
              <Label>Ngày thu</Label>
              <Input type="date" {...register('collectionDate')} />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label>Ghi chú</Label>
              <Textarea rows={2} {...register('note')} />
            </div>
            <div className="flex gap-2 md:col-span-2">
              <Button type="submit" disabled={isSubmitting}>
                {editing ? 'Cập nhật' : 'Thêm'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowForm(false);
                  setEditing(null);
                }}
              >
                Hủy
              </Button>
            </div>
          </form>
        ) : null}

        <QueryState
          loading={loading}
          error={error}
          empty={items.length === 0}
          emptyMessage="Chưa có bản ghi thu tiền."
          onRetry={load}
        >
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Số CT</TableHead>
                  <TableHead>Kỳ</TableHead>
                  <TableHead>Số tiền</TableHead>
                  <TableHead>Ngày thu</TableHead>
                  <TableHead>Ghi chú</TableHead>
                  <TableHead className="text-right">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.collectionNo}</TableCell>
                    <TableCell>{formatPeriod(item.period)}</TableCell>
                    <TableCell>{formatCurrencyVND(item.amount)}</TableCell>
                    <TableCell>{formatDate(item.collectionDate)}</TableCell>
                    <TableCell>{item.note || '—'}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="secondary" onClick={() => openEdit(item)}>
                          Sửa
                        </Button>
                        <ConfirmDeleteButton
                          onConfirm={() => handleDelete(item.id)}
                          title="Xóa thu tiền?"
                          description={`Xóa bản ghi ${item.collectionNo}.`}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </QueryState>
      </CardContent>
    </Card>
  );
}
