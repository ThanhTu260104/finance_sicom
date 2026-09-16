'use client';

import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { financialControlApi, revenuePlansApi } from '@/lib/api';
import {
  formatCurrencyVND,
  formatPeriod,
  isNegativeDecimal,
} from '@/lib/format';
import {
  isValidAmount,
  isValidPeriod,
  normalizeAmount,
} from '@/lib/csv';
import type { ContractFinanceSummary, PeriodComparison } from '@/lib/types';
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

const PERIOD_OPTIONS = buildPeriodOptions();

const PLAN_CSV_COLUMNS = [
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
    key: 'plannedAmount',
    header: 'KeHoach',
    aliases: ['plannedAmount', 'Kế hoạch', 'amount'],
    required: true,
    sample: '625000000',
    type: 'money' as const,
  },
  {
    key: 'note',
    header: 'GhiChu',
    aliases: ['note', 'Ghi chú'],
    sample: 'Kế hoạch tháng 1',
  },
];

const schema = z.object({
  period: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Kỳ phải dạng YYYY-MM'),
  plannedAmount: z
    .string()
    .min(1, 'Bắt buộc')
    .refine((v) => !Number.isNaN(Number(v)) && Number(v) >= 0, {
      message: 'Số tiền ≥ 0',
    })
    .refine((v) => /^\d+(\.\d{1,2})?$/.test(v), {
      message: 'Tối đa 2 chữ số thập phân',
    }),
  note: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

function VarianceCell({ value }: { value: string }) {
  const negative = isNegativeDecimal(value);
  return (
    <span className={negative ? 'text-red-600' : 'text-emerald-700'}>
      {formatCurrencyVND(value)}
    </span>
  );
}

export function RevenuePlansSection({
  contractId,
  finance,
  onChanged,
}: {
  contractId: string;
  finance: ContractFinanceSummary;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState<PeriodComparison | null>(null);
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
      period: '',
      plannedAmount: '',
      note: '',
    },
  });

  const openCreate = () => {
    setEditing(null);
    reset({ period: '', plannedAmount: '', note: '' });
    setShowForm(true);
  };

  const openEdit = (row: PeriodComparison) => {
    if (!row.revenuePlanId) return;
    setEditing(row);
    reset({
      period: row.period,
      plannedAmount: row.plannedAmount,
      note: row.note ?? '',
    });
    setShowForm(true);
  };

  const onSubmit = async (values: FormValues) => {
    const payload = {
      period: values.period,
      plannedAmount: Number(values.plannedAmount),
      note: values.note || undefined,
    };

    try {
      if (editing?.revenuePlanId) {
        await revenuePlansApi.update(editing.revenuePlanId, payload);
        toast.success('Cập nhật kế hoạch thành công');
      } else {
        await revenuePlansApi.create(contractId, payload);
        toast.success('Thêm kế hoạch thành công');
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
      await revenuePlansApi.remove(id);
      toast.success('Đã xóa kế hoạch');
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Xóa thất bại');
    }
  };

  const handleImportCsv = async (rows: Array<Record<string, string>>) => {
    await financialControlApi.bulkPlans(contractId, {
      items: rows.map((row) => ({
        period: row.period.trim(),
        plannedAmount: Number(normalizeAmount(row.plannedAmount)),
        note: row.note?.trim() || undefined,
      })),
    });
    onChanged();
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base">Kế hoạch nghiệm thu theo đợt</CardTitle>
            <p className="mt-1 text-sm font-normal text-slate-500">
              Mỗi dòng là một đợt nghiệm thu. HĐ theo quý chỉ cần tạo một dòng vào tháng cuối quý.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <CsvDataTransfer
              title="kế hoạch nghiệm thu theo đợt"
              filenamePrefix={`ke-hoach-${contractId.slice(0, 8)}`}
              columns={PLAN_CSV_COLUMNS}
              sampleRows={[
                {
                  period: '2026-01',
                  plannedAmount: '0',
                  note: 'Tháng đầu = 0',
                },
                {
                  period: '2026-02',
                  plannedAmount: '625000000',
                  note: 'Kế hoạch tháng 2',
                },
              ]}
              exportRows={finance.comparison
                .filter((row) => row.revenuePlanId)
                .map((row) => ({
                  period: row.period,
                  plannedAmount: row.plannedAmount,
                  note: row.note ?? '',
                }))}
              validateRow={(row) => {
                const errors: string[] = [];
                if (!isValidPeriod(row.period ?? '')) {
                  errors.push('Kỳ phải dạng YYYY-MM');
                }
                if (!isValidAmount(row.plannedAmount ?? '')) {
                  errors.push('Số tiền không hợp lệ');
                }
                return errors;
              }}
              onImport={handleImportCsv}
            />
            <Button size="sm" onClick={openCreate}>
              Thêm kỳ
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!finance.planMatchesContractValue && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Tổng các đợt đã lập ({formatCurrencyVND(finance.totalPlanned)}) khác giá
              trị hợp đồng ({formatCurrencyVND(finance.contractValue)}). Nếu hợp đồng còn các
              đợt chưa đến hạn, hãy bổ sung thêm các kỳ tương ứng.
            </div>
          )}

          {showForm && (
            <form
              onSubmit={handleSubmit(onSubmit)}
              className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50/80 p-4 md:grid-cols-2"
            >
              <div className="space-y-2">
                <Label>Kỳ * (YYYY-MM)</Label>
                <Input {...register('period')} placeholder="2026-08" />
                {errors.period && (
                  <p className="text-xs text-red-600">{errors.period.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Số tiền kế hoạch *</Label>
                <Controller
                  name="plannedAmount"
                  control={control}
                  render={({ field }) => (
                    <MoneyInput
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                    />
                  )}
                />
                {errors.plannedAmount && (
                  <p className="text-xs text-red-600">
                    {errors.plannedAmount.message}
                  </p>
                )}
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Ghi chú</Label>
                <Textarea {...register('note')} />
              </div>
              <div className="flex gap-2 md:col-span-2">
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

          {finance.comparison.length === 0 ? (
            <p className="text-sm text-slate-500">
              Chưa có kế hoạch nghiệm thu.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Kỳ</TableHead>
                    <TableHead>Kế hoạch nghiệm thu</TableHead>
                    <TableHead>Thực tế nghiệm thu</TableHead>
                    <TableHead>Chênh lệch</TableHead>
                    <TableHead className="text-right">Thao tác</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {finance.comparison.map((row) => (
                    <TableRow key={row.period}>
                      <TableCell className="font-medium">
                        {formatPeriod(row.period)}
                      </TableCell>
                      <TableCell>
                        {formatCurrencyVND(row.plannedAmount)}
                      </TableCell>
                      <TableCell>
                        {formatCurrencyVND(row.actualAmount)}
                      </TableCell>
                      <TableCell>
                        <VarianceCell value={row.variance} />
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          {row.revenuePlanId ? (
                            <>
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => openEdit(row)}
                              >
                                Sửa
                              </Button>
                              <ConfirmDeleteButton
                                onConfirm={() =>
                                  handleDelete(row.revenuePlanId as string)
                                }
                                title="Xóa kế hoạch?"
                                description={`Xóa kế hoạch kỳ ${formatPeriod(row.period)}.`}
                              />
                            </>
                          ) : (
                            <span className="text-xs text-slate-400">
                              Chỉ có thực tế
                            </span>
                          )}
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
    </div>
  );
}
