'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { customersApi, projectsApi } from '@/lib/api';
import { toDateInputValue } from '@/lib/format';
import type { Customer, Project } from '@/lib/types';
import { DEFAULT_COMPANY_ID, PROJECT_STATUSES } from '@/lib/types';
import { projectStatusLabel } from '@/components/shared/status-badges';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const schema = z
  .object({
    code: z.string().min(1, 'Bắt buộc'),
    name: z.string().min(1, 'Bắt buộc'),
    companyId: z.string().uuid('UUID không hợp lệ'),
    customerId: z.string().optional(),
    projectType: z.string().optional(),
    location: z.string().optional(),
    address: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    status: z.enum([
      'PLANNING',
      'ACTIVE',
      'SUSPENDED',
      'COMPLETED',
      'CANCELLED',
    ]),
    description: z.string().optional(),
    note: z.string().optional(),
  })
  .refine(
    (data) =>
      !data.startDate ||
      !data.endDate ||
      new Date(data.startDate) <= new Date(data.endDate),
    { message: 'Ngày bắt đầu phải ≤ ngày kết thúc', path: ['endDate'] },
  );

type FormValues = z.infer<typeof schema>;

export function ProjectForm({
  projectId,
  initial,
}: {
  projectId?: string;
  initial?: Project;
}) {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      code: initial?.code ?? '',
      name: initial?.name ?? '',
      companyId: initial?.companyId ?? DEFAULT_COMPANY_ID,
      customerId: initial?.customerId ?? '',
      projectType: initial?.projectType ?? '',
      location: initial?.location ?? '',
      address: initial?.address ?? '',
      startDate: toDateInputValue(initial?.startDate),
      endDate: toDateInputValue(initial?.endDate),
      status: initial?.status ?? 'PLANNING',
      description: initial?.description ?? '',
      note: initial?.note ?? '',
    },
  });

  useEffect(() => {
    customersApi
      .list({ limit: 100, status: 'ACTIVE' })
      .then((res) => setCustomers(res.data))
      .catch(() => toast.error('Không tải được khách hàng'));
  }, []);

  const onSubmit = async (values: FormValues) => {
    const payload = {
      code: values.code,
      name: values.name,
      companyId: values.companyId,
      customerId: values.customerId || undefined,
      projectType: values.projectType || undefined,
      location: values.location || undefined,
      address: values.address || undefined,
      status: values.status,
      description: values.description || undefined,
      note: values.note || undefined,
      startDate: values.startDate
        ? new Date(values.startDate).toISOString()
        : undefined,
      endDate: values.endDate
        ? new Date(values.endDate).toISOString()
        : undefined,
    };

    try {
      if (projectId) {
        await projectsApi.update(projectId, payload);
        toast.success('Cập nhật dự án thành công');
        router.push(`/projects/${projectId}`);
      } else {
        const created = await projectsApi.create(payload);
        toast.success('Tạo dự án thành công');
        router.push(`/projects/${created.id}`);
      }
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Lưu thất bại');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{projectId ? 'Sửa dự án' : 'Thêm dự án'}</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="grid gap-4 md:grid-cols-2"
        >
          <div className="space-y-2">
            <Label>Mã dự án *</Label>
            <Input {...register('code')} />
            {errors.code && (
              <p className="text-xs text-red-600">{errors.code.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Tên dự án *</Label>
            <Input {...register('name')} />
            {errors.name && (
              <p className="text-xs text-red-600">{errors.name.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Công ty *</Label>
            <Input {...register('companyId')} />
            <p className="text-xs text-slate-500">
              Backend chưa có API Company — nhập UUID công ty.
            </p>
            {errors.companyId && (
              <p className="text-xs text-red-600">{errors.companyId.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Khách hàng</Label>
            <Select {...register('customerId')}>
              <option value="">— Chọn —</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Loại dự án</Label>
            <Input {...register('projectType')} />
          </div>
          <div className="space-y-2">
            <Label>Trạng thái</Label>
            <Select {...register('status')}>
              {PROJECT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {projectStatusLabel[s]}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Địa điểm</Label>
            <Input {...register('location')} />
          </div>
          <div className="space-y-2">
            <Label>Địa chỉ</Label>
            <Input {...register('address')} />
          </div>
          <div className="space-y-2">
            <Label>Ngày bắt đầu</Label>
            <Input type="date" {...register('startDate')} />
          </div>
          <div className="space-y-2">
            <Label>Ngày kết thúc</Label>
            <Input type="date" {...register('endDate')} />
            {errors.endDate && (
              <p className="text-xs text-red-600">{errors.endDate.message}</p>
            )}
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Mô tả</Label>
            <Textarea {...register('description')} />
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
