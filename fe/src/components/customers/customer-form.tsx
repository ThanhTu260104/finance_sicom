'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { customersApi } from '@/lib/api';
import type { Customer } from '@/lib/types';
import { CUSTOMER_STATUSES } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const schema = z.object({
  code: z.string().min(1, 'Bắt buộc'),
  name: z.string().min(1, 'Bắt buộc'),
  taxCode: z.string().optional(),
  address: z.string().optional(),
  contactName: z.string().optional(),
  contactPhone: z.string().optional(),
  contactEmail: z
    .string()
    .email('Email không hợp lệ')
    .optional()
    .or(z.literal('')),
  status: z.enum(['ACTIVE', 'INACTIVE']),
  note: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export function CustomerForm({
  customerId,
  initial,
  onSuccess,
  onCancel,
}: {
  customerId?: string;
  initial?: Customer;
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
      name: initial?.name ?? '',
      taxCode: initial?.taxCode ?? '',
      address: initial?.address ?? '',
      contactName: initial?.contactName ?? '',
      contactPhone: initial?.contactPhone ?? '',
      contactEmail: initial?.contactEmail ?? '',
      status: initial?.status ?? 'ACTIVE',
      note: initial?.note ?? '',
    },
  });

  const onSubmit = async (values: FormValues) => {
    const payload = {
      code: values.code,
      name: values.name,
      taxCode: values.taxCode || undefined,
      address: values.address || undefined,
      contactName: values.contactName || undefined,
      contactPhone: values.contactPhone || undefined,
      contactEmail: values.contactEmail || undefined,
      status: values.status,
      note: values.note || undefined,
    };

    try {
      if (customerId) {
        await customersApi.update(customerId, payload);
        toast.success('Cập nhật khách hàng thành công');
      } else {
        await customersApi.create(payload);
        toast.success('Tạo khách hàng thành công');
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
          {customerId ? 'Sửa khách hàng' : 'Thêm khách hàng'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="grid gap-4 md:grid-cols-2"
        >
          <div className="space-y-2">
            <Label>Mã khách hàng *</Label>
            <Input {...register('code')} />
            {errors.code && (
              <p className="text-xs text-red-600">{errors.code.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Tên khách hàng *</Label>
            <Input {...register('name')} />
            {errors.name && (
              <p className="text-xs text-red-600">{errors.name.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Mã số thuế</Label>
            <Input {...register('taxCode')} />
          </div>
          <div className="space-y-2">
            <Label>Trạng thái</Label>
            <Select {...register('status')}>
              {CUSTOMER_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s === 'ACTIVE' ? 'Hoạt động' : 'Ngừng'}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Địa chỉ</Label>
            <Input {...register('address')} />
          </div>
          <div className="space-y-2">
            <Label>Người liên hệ</Label>
            <Input {...register('contactName')} />
          </div>
          <div className="space-y-2">
            <Label>Số điện thoại</Label>
            <Input {...register('contactPhone')} />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input type="email" {...register('contactEmail')} />
            {errors.contactEmail && (
              <p className="text-xs text-red-600">
                {errors.contactEmail.message}
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
            <Button type="button" variant="outline" onClick={onCancel}>
              Hủy
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
