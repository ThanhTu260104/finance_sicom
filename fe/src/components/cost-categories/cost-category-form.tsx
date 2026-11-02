'use client';

import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { costCategoriesApi } from '@/lib/api';
import type { CostCategory } from '@/lib/types';
import { EMPLOYEE_STATUSES } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const schema = z.object({
  code: z.string().min(1, 'Bắt buộc'),
  name: z.string().min(1, 'Bắt buộc'),
  sortOrder: z
    .string()
    .optional()
    .refine((v) => !v || !Number.isNaN(Number(v)), 'Số không hợp lệ'),
  status: z.enum(['ACTIVE', 'INACTIVE']),
  note: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export function CostCategoryForm({
  categoryId,
  initial,
  onSuccess,
  onCancel,
}: {
  categoryId?: string;
  initial?: CostCategory;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      code: initial?.code ?? '',
      name: initial?.name ?? '',
      sortOrder: initial?.sortOrder != null ? String(initial.sortOrder) : '0',
      status: initial?.status ?? 'ACTIVE',
      note: initial?.note ?? '',
    },
  });

  const onSubmit = async (values: FormValues) => {
    const payload = {
      code: values.code.trim(),
      name: values.name.trim(),
      sortOrder: values.sortOrder ? Number(values.sortOrder) : 0,
      status: values.status,
      note: values.note?.trim() || undefined,
    };

    try {
      if (categoryId) {
        await costCategoriesApi.update(categoryId, payload);
        toast.success('Cập nhật loại chi phí');
      } else {
        await costCategoriesApi.create(payload);
        toast.success('Thêm loại chi phí');
      }
      onSuccess();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Lưu thất bại');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {categoryId ? 'Sửa loại chi phí' : 'Thêm loại chi phí'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Mã loại *</Label>
            <Input {...register('code')} placeholder="CP_PHAT_SINH" />
            {errors.code && (
              <p className="text-xs text-red-600">{errors.code.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Tên hiển thị *</Label>
            <Input {...register('name')} placeholder="Chi phí phát sinh" />
            {errors.name && (
              <p className="text-xs text-red-600">{errors.name.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Thứ tự</Label>
            <Input {...register('sortOrder')} inputMode="numeric" />
          </div>
          <div className="space-y-2">
            <Label>Trạng thái</Label>
            <Select {...register('status')}>
              {EMPLOYEE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s === 'ACTIVE' ? 'Đang dùng' : 'Ngừng'}
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
