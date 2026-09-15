'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { contractsApi, projectsApi } from '@/lib/api';
import { toDateInputValue } from '@/lib/format';
import type { Contract, Project } from '@/lib/types';
import {
  BILLING_CYCLES,
  CONTRACT_STATUSES,
  CONTRACT_TYPES,
} from '@/lib/types';
import {
  billingCycleLabel,
  contractStatusLabel,
  contractTypeLabel,
} from '@/components/shared/status-badges';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MoneyInput } from '@/components/ui/money-input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const schema = z.object({
  projectId: z.string().uuid('Chọn dự án'),
  contractNo: z.string().min(1, 'Bắt buộc'),
  name: z.string().min(1, 'Bắt buộc'),
  contractType: z.enum(['MAIN', 'APPENDIX', 'SERVICE', 'OTHER']),
  contractValue: z
    .string()
    .min(1, 'Bắt buộc')
    .refine((v) => !Number.isNaN(Number(v)) && Number(v) >= 0, {
      message: 'Giá trị ≥ 0',
    })
    .refine((v) => /^\d+(\.\d{1,2})?$/.test(v), {
      message: 'Tối đa 2 chữ số thập phân',
    }),
  billingCycle: z.enum([
    'MONTHLY',
    'BIMONTHLY',
    'QUARTERLY',
    'SEMI_ANNUALLY',
    'ANNUALLY',
    'MILESTONE',
    'CUSTOM',
  ]),
  signedDate: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  status: z.enum([
    'DRAFT',
    'ACTIVE',
    'COMPLETED',
    'TERMINATED',
    'CANCELLED',
  ]),
  note: z.string().optional(),
  paymentTermDays: z
    .string()
    .min(1, 'Bắt buộc')
    .refine((v) => /^\d+$/.test(v) && Number(v) >= 0, {
      message: 'Số ngày ≥ 0',
    }),
});

type FormValues = z.infer<typeof schema>;

function decimalToInput(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') return '';
  return String(value);
}

export function ContractForm({
  contractId,
  initial,
  defaultProjectId,
}: {
  contractId?: string;
  initial?: Contract;
  defaultProjectId?: string;
}) {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      projectId: initial?.projectId ?? defaultProjectId ?? '',
      contractNo: initial?.contractNo ?? '',
      name: initial?.name ?? '',
      contractType: initial?.contractType ?? 'MAIN',
      contractValue: decimalToInput(initial?.contractValue),
      billingCycle: initial?.billingCycle ?? 'MONTHLY',
      signedDate: toDateInputValue(initial?.signedDate),
      startDate: toDateInputValue(initial?.startDate),
      endDate: toDateInputValue(initial?.endDate),
      status: initial?.status ?? 'DRAFT',
      note: initial?.note ?? '',
      paymentTermDays: String(initial?.paymentTermDays ?? 60),
    },
  });

  useEffect(() => {
    projectsApi
      .list({ limit: 100, sortBy: 'code', sortOrder: 'asc' })
      .then((res) => setProjects(res.data))
      .catch(() => toast.error('Không tải được dự án'));
  }, []);

  const onSubmit = async (values: FormValues) => {
    const payload = {
      projectId: values.projectId,
      contractNo: values.contractNo,
      name: values.name,
      contractType: values.contractType,
      contractValue: Number(values.contractValue),
      billingCycle: values.billingCycle,
      status: values.status,
      note: values.note || undefined,
      paymentTermDays: Number(values.paymentTermDays),
      signedDate: values.signedDate
        ? new Date(values.signedDate).toISOString()
        : undefined,
      startDate: values.startDate
        ? new Date(values.startDate).toISOString()
        : undefined,
      endDate: values.endDate
        ? new Date(values.endDate).toISOString()
        : undefined,
    };

    try {
      if (contractId) {
        await contractsApi.update(contractId, payload);
        toast.success('Cập nhật hợp đồng thành công');
        router.push(`/contracts/${contractId}`);
      } else {
        const created = await contractsApi.create(payload);
        toast.success('Tạo hợp đồng thành công');
        router.push(`/contracts/${created.id}`);
      }
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Lưu thất bại');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{contractId ? 'Sửa hợp đồng' : 'Thêm hợp đồng'}</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="grid gap-4 md:grid-cols-2"
        >
          <div className="space-y-2">
            <Label>Dự án *</Label>
            <Select {...register('projectId')}>
              <option value="">— Chọn dự án —</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} — {p.name}
                </option>
              ))}
            </Select>
            {errors.projectId && (
              <p className="text-xs text-red-600">{errors.projectId.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Số hợp đồng *</Label>
            <Input {...register('contractNo')} />
            {errors.contractNo && (
              <p className="text-xs text-red-600">
                {errors.contractNo.message}
              </p>
            )}
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Tên hợp đồng *</Label>
            <Input {...register('name')} />
            {errors.name && (
              <p className="text-xs text-red-600">{errors.name.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Loại hợp đồng *</Label>
            <Select {...register('contractType')}>
              {CONTRACT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {contractTypeLabel[t]}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Giá trị hợp đồng *</Label>
            <Controller
              name="contractValue"
              control={control}
              render={({ field }) => (
                <MoneyInput
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                />
              )}
            />
            {errors.contractValue && (
              <p className="text-xs text-red-600">
                {errors.contractValue.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Ngày ký</Label>
            <Input type="date" {...register('signedDate')} />
          </div>
          <div className="space-y-2">
            <Label>Chu kỳ nghiệm thu *</Label>
            <Select {...register('billingCycle')}>
              {BILLING_CYCLES.map((c) => (
                <option key={c} value={c}>
                  {billingCycleLabel[c]}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Ngày bắt đầu</Label>
            <Input type="date" {...register('startDate')} />
          </div>
          <div className="space-y-2">
            <Label>Ngày kết thúc</Label>
            <Input type="date" {...register('endDate')} />
          </div>
          <div className="space-y-2">
            <Label>Trạng thái</Label>
            <Select {...register('status')}>
              {CONTRACT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {contractStatusLabel[s]}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Điều khoản thanh toán (ngày) *</Label>
            <Input
              {...register('paymentTermDays')}
              inputMode="numeric"
              placeholder="60"
            />
            {errors.paymentTermDays && (
              <p className="text-xs text-red-600">
                {errors.paymentTermDays.message}
              </p>
            )}
            <p className="text-xs text-slate-500">
              Tuổi nợ = ngày hóa đơn + số ngày này
            </p>
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
              onClick={() => router.back()}
            >
              Hủy
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export function ContractFormWithSearchParams({
  contractId,
  initial,
}: {
  contractId?: string;
  initial?: Contract;
}) {
  const searchParams = useSearchParams();
  const defaultProjectId = searchParams.get('projectId') ?? undefined;
  return (
    <ContractForm
      contractId={contractId}
      initial={initial}
      defaultProjectId={defaultProjectId}
    />
  );
}
