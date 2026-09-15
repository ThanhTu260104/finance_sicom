'use client';

import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { acceptancesApi } from '@/lib/api';
import {
  formatCurrencyVND,
  formatDate,
  formatPeriod,
  toDateInputValue,
} from '@/lib/format';
import {
  isValidAmount,
  isValidOptionalDate,
  isValidPeriod,
  normalizeAmount,
} from '@/lib/csv';
import type { Acceptance } from '@/lib/types';
import {
  ACCEPTANCE_PAYMENT_STATUSES,
  DOCUMENT_STATUSES,
} from '@/lib/types';
import {
  AcceptancePaymentStatusBadge,
  DocumentStatusBadge,
  acceptancePaymentStatusLabel,
  documentStatusLabel,
} from '@/components/shared/status-badges';
import { ConfirmDeleteButton } from '@/components/shared/confirm-delete-button';
import {
  buildPeriodOptions,
  CsvDataTransfer,
} from '@/components/shared/csv-data-transfer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MoneyInput } from '@/components/ui/money-input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
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

const PERIOD_OPTIONS = buildPeriodOptions();

const ACCEPTANCE_CSV_COLUMNS = [
  {
    key: 'acceptanceNo',
    header: 'SoDot',
    aliases: ['acceptanceNo', 'Số đợt', 'dot'],
    required: true,
    sample: 'Đợt 01/2026',
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
    aliases: ['amount', 'Số tiền', 'gia tri'],
    required: true,
    sample: '500000000',
    type: 'money' as const,
  },
  {
    key: 'acceptanceDate',
    header: 'NgayNT',
    aliases: ['acceptanceDate', 'Ngày NT', 'ngay nt'],
    sample: '2026-01-28',
    type: 'date' as const,
  },
  {
    key: 'invoiceNo',
    header: 'SoHoaDon',
    aliases: ['invoiceNo', 'Số HĐ', 'so hd'],
    sample: 'HD-01/2026',
  },
  {
    key: 'invoiceDate',
    header: 'NgayHoaDon',
    aliases: ['invoiceDate', 'Ngày HĐ', 'ngay hd'],
    sample: '2026-01-28',
    type: 'date' as const,
  },
  {
    key: 'documentStatus',
    header: 'HoSo',
    aliases: ['documentStatus', 'Hồ sơ'],
    sample: 'SUBMITTED_UNPAID',
    type: 'select' as const,
    options: DOCUMENT_STATUSES.map((s) => ({
      value: s,
      label: documentStatusLabel[s],
    })),
  },
  {
    key: 'paymentStatus',
    header: 'ThanhToan',
    aliases: ['paymentStatus', 'Thanh toán'],
    sample: 'WAITING_CLIENT_PAYMENT',
    type: 'select' as const,
    options: ACCEPTANCE_PAYMENT_STATUSES.map((s) => ({
      value: s,
      label: acceptancePaymentStatusLabel[s],
    })),
  },
  {
    key: 'note',
    header: 'GhiChu',
    aliases: ['note', 'Ghi chú'],
    sample: 'Nghiệm thu tháng 1',
  },
];

function toIsoDate(value?: string) {
  const v = value?.trim();
  if (!v) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    return new Date(`${v}T00:00:00.000Z`).toISOString();
  }
  return new Date(v).toISOString();
}

function normalizeDocumentStatus(value: string) {
  const raw = value.trim().toUpperCase();
  if (!raw) return 'NOT_SUBMITTED' as const;
  if (
    raw === 'NOT_SUBMITTED' ||
    raw === 'CHUA_NOP' ||
    raw.includes('CHUA')
  ) {
    return 'NOT_SUBMITTED' as const;
  }
  if (
    raw === 'SUBMITTED_UNPAID' ||
    raw === 'DA_NOP' ||
    raw.includes('NOP')
  ) {
    return 'SUBMITTED_UNPAID' as const;
  }
  return null;
}

function normalizePaymentStatus(value: string, documentStatus: string) {
  if (documentStatus === 'NOT_SUBMITTED') return 'NOT_ACCEPTED' as const;
  const raw = value.trim().toUpperCase();
  if (!raw || raw === 'WAITING_CLIENT_PAYMENT' || raw === 'CHO_THANH_TOAN') {
    return 'WAITING_CLIENT_PAYMENT' as const;
  }
  if (raw === 'COLLECTED' || raw === 'DA_THU') {
    return 'COLLECTED' as const;
  }
  if (raw === 'NOT_ACCEPTED' || raw === 'CHUA_NT') return 'NOT_ACCEPTED' as const;
  return null;
}

const schema = z.object({
  acceptanceNo: z.string().min(1, 'Bắt buộc'),
  period: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Kỳ phải dạng YYYY-MM'),
  acceptanceDate: z.string().optional(),
  invoiceNo: z.string().optional(),
  invoiceDate: z.string().optional(),
  amount: z
    .string()
    .min(1, 'Bắt buộc')
    .refine((v) => !Number.isNaN(Number(v)) && Number(v) >= 0, {
      message: 'Giá trị ≥ 0',
    })
    .refine((v) => /^\d+(\.\d{1,2})?$/.test(v), {
      message: 'Tối đa 2 chữ số thập phân',
    }),
  documentStatus: z.enum(['NOT_SUBMITTED', 'SUBMITTED_UNPAID']),
  paymentStatus: z.enum([
    'NOT_ACCEPTED',
    'WAITING_CLIENT_PAYMENT',
    'COLLECTED',
  ]),
  note: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

function AgingCell({ item }: { item: Acceptance }) {
  if (item.documentStatus === 'NOT_SUBMITTED') {
    return <span className="text-slate-400">—</span>;
  }
  if (item.paymentStatus === 'COLLECTED') {
    return <span className="text-emerald-700">Đã thu</span>;
  }
  if (item.agingDays == null) {
    return <span className="text-slate-400">—</span>;
  }
  if (item.agingDays > 0) {
    return (
      <span className="font-medium text-red-600">
        Quá hạn {item.agingDays} ngày
      </span>
    );
  }
  if (item.daysUntilDue != null && item.daysUntilDue > 0) {
    return (
      <span className="text-amber-700">Còn {item.daysUntilDue} ngày</span>
    );
  }
  return <span className="text-slate-600">Đến hạn</span>;
}

export function AcceptancesSection({
  contractId,
  items,
  onChanged,
}: {
  contractId: string;
  items: Acceptance[];
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState<Acceptance | null>(null);
  const [viewing, setViewing] = useState<Acceptance | null>(null);
  const [showForm, setShowForm] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      acceptanceNo: '',
      period: '',
      acceptanceDate: '',
      invoiceNo: '',
      invoiceDate: '',
      amount: '',
      documentStatus: 'NOT_SUBMITTED',
      paymentStatus: 'NOT_ACCEPTED',
      note: '',
    },
  });

  const documentStatus = watch('documentStatus');

  const openCreate = () => {
    setEditing(null);
    setViewing(null);
    reset({
      acceptanceNo: '',
      period: '',
      acceptanceDate: '',
      invoiceNo: '',
      invoiceDate: '',
      amount: '',
      documentStatus: 'NOT_SUBMITTED',
      paymentStatus: 'NOT_ACCEPTED',
      note: '',
    });
    setShowForm(true);
  };

  const openEdit = (item: Acceptance) => {
    setEditing(item);
    setViewing(null);
    reset({
      acceptanceNo: item.acceptanceNo,
      period: item.period,
      acceptanceDate: toDateInputValue(item.acceptanceDate),
      invoiceNo: item.invoiceNo ?? '',
      invoiceDate: toDateInputValue(item.invoiceDate),
      amount: String(item.amount),
      documentStatus: item.documentStatus,
      paymentStatus: item.paymentStatus,
      note: item.note ?? '',
    });
    setShowForm(true);
  };

  const onSubmit = async (values: FormValues) => {
    const payload = {
      acceptanceNo: values.acceptanceNo,
      period: values.period,
      amount: Number(values.amount),
      documentStatus: values.documentStatus,
      paymentStatus:
        values.documentStatus === 'NOT_SUBMITTED'
          ? ('NOT_ACCEPTED' as const)
          : values.paymentStatus,
      note: values.note || undefined,
      invoiceNo: values.invoiceNo || undefined,
      acceptanceDate: values.acceptanceDate
        ? new Date(values.acceptanceDate).toISOString()
        : undefined,
      invoiceDate: values.invoiceDate
        ? new Date(values.invoiceDate).toISOString()
        : undefined,
    };

    try {
      if (editing) {
        await acceptancesApi.update(editing.id, payload);
        toast.success('Cập nhật nghiệm thu thành công');
      } else {
        await acceptancesApi.create(contractId, payload);
        toast.success('Thêm nghiệm thu thành công');
      }
      setShowForm(false);
      setEditing(null);
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Lưu thất bại');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await acceptancesApi.remove(id);
      toast.success('Đã xóa nghiệm thu');
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Xóa thất bại');
    }
  };

  const handleImportCsv = async (rows: Array<Record<string, string>>) => {
    await acceptancesApi.bulkUpsert(
      contractId,
      rows.map((row) => {
        const documentStatus =
          normalizeDocumentStatus(row.documentStatus ?? '') ?? 'NOT_SUBMITTED';
        const paymentStatus =
          normalizePaymentStatus(row.paymentStatus ?? '', documentStatus) ??
          (documentStatus === 'NOT_SUBMITTED'
            ? 'NOT_ACCEPTED'
            : 'WAITING_CLIENT_PAYMENT');
        return {
          acceptanceNo: row.acceptanceNo.trim(),
          period: row.period.trim(),
          amount: Number(normalizeAmount(row.amount)),
          acceptanceDate: toIsoDate(row.acceptanceDate),
          invoiceNo: row.invoiceNo?.trim() || undefined,
          invoiceDate: toIsoDate(row.invoiceDate),
          documentStatus,
          paymentStatus,
          note: row.note?.trim() || undefined,
        };
      }),
    );
    onChanged();
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="text-base">Nghiệm thu</CardTitle>
          <p className="mt-1 text-xs text-slate-500">
            Chưa nộp hồ sơ = chưa nghiệm thu. Chọn <strong>Đã thu</strong> sẽ
            đồng bộ sang Thu tiền; nhập Thu tiền cũng cập nhật lại trạng thái
            NT.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CsvDataTransfer
            title="nghiệm thu"
            filenamePrefix={`nghiem-thu-${contractId.slice(0, 8)}`}
            columns={ACCEPTANCE_CSV_COLUMNS}
            sampleRows={[
              {
                acceptanceNo: 'Đợt 01/2026',
                period: '2026-01',
                amount: '500000000',
                acceptanceDate: '2026-01-28',
                invoiceNo: 'HD-01/2026',
                invoiceDate: '2026-01-28',
                documentStatus: 'SUBMITTED_UNPAID',
                paymentStatus: 'COLLECTED',
                note: 'Đã NT và đã thu',
              },
              {
                acceptanceNo: 'Đợt 02/2026',
                period: '2026-02',
                amount: '500000000',
                acceptanceDate: '2026-02-28',
                invoiceNo: 'HD-02/2026',
                invoiceDate: '2026-02-28',
                documentStatus: 'SUBMITTED_UNPAID',
                paymentStatus: 'WAITING_CLIENT_PAYMENT',
                note: 'Chờ CĐT thanh toán',
              },
              {
                acceptanceNo: 'Đợt 03/2026',
                period: '2026-03',
                amount: '500000000',
                acceptanceDate: '',
                invoiceNo: '',
                invoiceDate: '',
                documentStatus: 'NOT_SUBMITTED',
                paymentStatus: 'NOT_ACCEPTED',
                note: 'Chưa nộp hồ sơ',
              },
            ]}
            exportRows={items.map((item) => ({
              acceptanceNo: item.acceptanceNo,
              period: item.period,
              amount: String(item.amount),
              acceptanceDate: item.acceptanceDate?.slice(0, 10) ?? '',
              invoiceNo: item.invoiceNo ?? '',
              invoiceDate: item.invoiceDate?.slice(0, 10) ?? '',
              documentStatus: item.documentStatus,
              paymentStatus: item.paymentStatus,
              note: item.note ?? '',
            }))}
            validateRow={(row) => {
              const errors: string[] = [];
              if (!row.acceptanceNo?.trim()) errors.push('Thiếu số đợt');
              if (!isValidPeriod(row.period ?? '')) {
                errors.push('Kỳ phải dạng YYYY-MM');
              }
              if (!isValidAmount(row.amount ?? '')) {
                errors.push('Số tiền không hợp lệ');
              }
              if (!isValidOptionalDate(row.acceptanceDate ?? '')) {
                errors.push('Ngày NT phải dạng YYYY-MM-DD');
              }
              if (!isValidOptionalDate(row.invoiceDate ?? '')) {
                errors.push('Ngày HĐ phải dạng YYYY-MM-DD');
              }
              if (normalizeDocumentStatus(row.documentStatus ?? '') == null) {
                errors.push(
                  'Hồ sơ: NOT_SUBMITTED | SUBMITTED_UNPAID',
                );
              }
              const doc =
                normalizeDocumentStatus(row.documentStatus ?? '') ??
                'NOT_SUBMITTED';
              if (
                normalizePaymentStatus(row.paymentStatus ?? '', doc) == null
              ) {
                errors.push(
                  'Thanh toán: NOT_ACCEPTED | WAITING_CLIENT_PAYMENT | COLLECTED',
                );
              }
              return errors;
            }}
            onImport={handleImportCsv}
          />
          <Button size="sm" onClick={openCreate}>
            Thêm nghiệm thu
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {viewing && !showForm && (
          <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-4 text-sm">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="font-medium">{viewing.acceptanceNo}</p>
              <Button size="sm" variant="outline" onClick={() => setViewing(null)}>
                Đóng
              </Button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <p>Kỳ: {formatPeriod(viewing.period)}</p>
              <p>Ngày NT: {formatDate(viewing.acceptanceDate)}</p>
              <p>Số HĐ: {viewing.invoiceNo || '—'}</p>
              <p>Ngày HĐ: {formatDate(viewing.invoiceDate)}</p>
              <p>
                Hạn thanh toán:{' '}
                {viewing.paymentDueDate
                  ? formatDate(viewing.paymentDueDate)
                  : '—'}
              </p>
              <p>Giá trị: {formatCurrencyVND(viewing.amount)}</p>
              <p>
                Hồ sơ: <DocumentStatusBadge status={viewing.documentStatus} />
              </p>
              <p>
                Thu tiền:{' '}
                <AcceptancePaymentStatusBadge status={viewing.paymentStatus} />
              </p>
              <p>
                Tuổi nợ: <AgingCell item={viewing} />
              </p>
              <p className="sm:col-span-2 lg:col-span-3">
                Ghi chú: {viewing.note || '—'}
              </p>
            </div>
          </div>
        )}

        {showForm && (
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50/80 p-4 md:grid-cols-2 lg:grid-cols-3"
          >
            <div className="space-y-2">
              <Label>Đợt nghiệm thu *</Label>
              <Input {...register('acceptanceNo')} placeholder="Đợt 08/2026" />
              {errors.acceptanceNo && (
                <p className="text-xs text-red-600">
                  {errors.acceptanceNo.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Kỳ * (YYYY-MM)</Label>
              <Input {...register('period')} placeholder="2026-08" />
              {errors.period && (
                <p className="text-xs text-red-600">{errors.period.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Ngày nghiệm thu</Label>
              <Input type="date" {...register('acceptanceDate')} />
            </div>
            <div className="space-y-2">
              <Label>Số hóa đơn</Label>
              <Input {...register('invoiceNo')} placeholder="HD-08/2026" />
            </div>
            <div className="space-y-2">
              <Label>Ngày hóa đơn</Label>
              <Input type="date" {...register('invoiceDate')} />
            </div>
            <div className="space-y-2">
              <Label>Giá trị *</Label>
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
              {errors.amount && (
                <p className="text-xs text-red-600">{errors.amount.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Trạng thái hồ sơ *</Label>
              <Select
                {...register('documentStatus')}
                onChange={(e) => {
                  const value = e.target.value as FormValues['documentStatus'];
                  setValue('documentStatus', value);
                  if (value === 'NOT_SUBMITTED') {
                    setValue('paymentStatus', 'NOT_ACCEPTED');
                  } else {
                    setValue('paymentStatus', 'WAITING_CLIENT_PAYMENT');
                  }
                }}
              >
                {DOCUMENT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {documentStatusLabel[s]}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Trạng thái thu tiền *</Label>
              <Select
                {...register('paymentStatus')}
                disabled={documentStatus === 'NOT_SUBMITTED'}
              >
                {ACCEPTANCE_PAYMENT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {acceptancePaymentStatusLabel[s]}
                  </option>
                ))}
              </Select>
              {documentStatus === 'NOT_SUBMITTED' ? (
                <p className="text-xs text-slate-500">
                  Chưa nộp hồ sơ ⇒ chưa nghiệm thu
                </p>
              ) : (
                <p className="text-xs text-slate-500">
                  Đã thu = tạo/cập nhật dòng Thu tiền. Chờ thanh toán = gỡ thu
                  tiền tự động của đợt này.
                </p>
              )}
            </div>
            <div className="space-y-2 md:col-span-2 lg:col-span-3">
              <Label>Ghi chú</Label>
              <Textarea {...register('note')} />
            </div>
            <div className="flex gap-2 md:col-span-2 lg:col-span-3">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Đang lưu...' : 'Lưu'}
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
        )}

        {items.length === 0 ? (
          <p className="text-sm text-slate-500">Chưa có nghiệm thu.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table className="min-w-[1100px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Đợt NT</TableHead>
                  <TableHead>Kỳ</TableHead>
                  <TableHead>Ngày NT</TableHead>
                  <TableHead>Số HĐ</TableHead>
                  <TableHead>Ngày HĐ</TableHead>
                  <TableHead>Giá trị</TableHead>
                  <TableHead>Hồ sơ</TableHead>
                  <TableHead>Thu tiền</TableHead>
                  <TableHead>Hạn TT</TableHead>
                  <TableHead>Tuổi nợ</TableHead>
                  <TableHead className="text-right">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">
                      {item.acceptanceNo}
                    </TableCell>
                    <TableCell>{formatPeriod(item.period)}</TableCell>
                    <TableCell>{formatDate(item.acceptanceDate)}</TableCell>
                    <TableCell>{item.invoiceNo || '—'}</TableCell>
                    <TableCell>{formatDate(item.invoiceDate)}</TableCell>
                    <TableCell>{formatCurrencyVND(item.amount)}</TableCell>
                    <TableCell>
                      <DocumentStatusBadge status={item.documentStatus} />
                    </TableCell>
                    <TableCell>
                      <AcceptancePaymentStatusBadge
                        status={item.paymentStatus}
                      />
                    </TableCell>
                    <TableCell>
                      {item.paymentDueDate
                        ? formatDate(item.paymentDueDate)
                        : '—'}
                    </TableCell>
                    <TableCell>
                      <AgingCell item={item} />
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setViewing(item);
                            setShowForm(false);
                          }}
                        >
                          Xem
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => openEdit(item)}
                        >
                          Sửa
                        </Button>
                        <ConfirmDeleteButton
                          onConfirm={() => handleDelete(item.id)}
                          title="Xóa nghiệm thu?"
                          description={`Xóa mềm nghiệm thu ${item.acceptanceNo}.`}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
