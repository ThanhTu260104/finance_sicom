'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { employeesApi } from '@/lib/api';
import type { Employee } from '@/lib/types';
import { EMPLOYEE_STATUSES } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const schema = z.object({
  code: z.string().min(1, 'Bắt buộc'),
  fullName: z.string().min(1, 'Bắt buộc'),
  jobTitle: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']),
  note: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export function EmployeeForm({
  employeeId,
  initial,
  onSuccess,
  onCancel,
}: {
  employeeId?: string;
  initial?: Employee;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      code: initial?.code ?? '',
      fullName: initial?.fullName ?? '',
      jobTitle: initial?.jobTitle ?? '',
      status: initial?.status ?? 'ACTIVE',
      note: initial?.note ?? '',
    },
  });

  const onSubmit = async (values: FormValues) => {
    const payload = {
      code: values.code.trim(),
      fullName: values.fullName.trim(),
      jobTitle: values.jobTitle?.trim() || undefined,
      status: values.status,
      note: values.note?.trim() || undefined,
    };

    try {
      if (employeeId) {
        await employeesApi.update(employeeId, payload);
        toast.success('Cập nhật nhân viên thành công');
      } else {
        await employeesApi.create(payload);
        toast.success('Tạo nhân viên thành công');
      }
      router.refresh();
      onSuccess();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Lưu thất bại');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {employeeId ? 'Sửa nhân viên' : 'Thêm nhân viên'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Mã nhân viên *</Label>
            <Input {...register('code')} placeholder="NV001" />
            {errors.code && (
              <p className="text-xs text-red-600">{errors.code.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Họ và tên *</Label>
            <Input {...register('fullName')} />
            {errors.fullName && (
              <p className="text-xs text-red-600">{errors.fullName.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Chức danh</Label>
            <Input {...register('jobTitle')} placeholder="PM, Kỹ sư…" />
          </div>
          <div className="space-y-2">
            <Label>Trạng thái</Label>
            <Select {...register('status')}>
              {EMPLOYEE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s === 'ACTIVE' ? 'Đang làm' : 'Ngừng'}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Ghi chú</Label>
            <Textarea {...register('note')} rows={2} />
          </div>
          <div className="flex gap-2 md:col-span-2">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Đang lưu...' : 'Lưu'}
            </Button>
            <Button type="button" variant="outline" onClick={onCancel}>
              Hủy
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
