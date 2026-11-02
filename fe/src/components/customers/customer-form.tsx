'use client';

import { useRouter } from 'next/navigation';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { customersApi } from '@/lib/api';
import type { Customer, PartnerType } from '@/lib/types';
import { CUSTOMER_STATUSES, PARTNER_TYPES } from '@/lib/types';
import { partnerTypeLabel } from '@/lib/contract-kind';
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
  partnerTypes: z
    .array(z.enum(['INVESTOR', 'SUBCONTRACTOR', 'SUPPLIER']))
    .min(1, 'Chọn ít nhất một loại đối tác'),
  note: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export function CustomerForm({
  customerId,
  initial,
  defaultPartnerType = 'INVESTOR',
  onSuccess,
  onCancel,
}: {
  customerId?: string;
  initial?: Customer;
  /** Loại tick sẵn khi tạo mới (theo tab đang mở) */
  defaultPartnerType?: PartnerType;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const router = useRouter();
  const {
    register,
    control,
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
      partnerTypes: initial?.partnerTypes?.length
        ? initial.partnerTypes
        : [defaultPartnerType],
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
      partnerTypes: values.partnerTypes,
      note: values.note || undefined,
    };

    try {
      if (customerId) {
        await customersApi.update(customerId, payload);
        toast.success('Cập nhật đối tác thành công');
      } else {
        await customersApi.create(payload);
        toast.success('Tạo đối tác thành công');
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
          {customerId ? 'Sửa đối tác' : 'Thêm đối tác'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="grid gap-4 md:grid-cols-2"
        >
          <div className="space-y-2 md:col-span-2">
            <Label>Loại đối tác *</Label>
            <Controller
              name="partnerTypes"
              control={control}
              render={({ field }) => (
                <div className="flex flex-wrap gap-3 rounded-md border border-slate-200 bg-slate-50/60 px-3 py-2.5">
                  {PARTNER_TYPES.map((type) => (
                    <label
                      key={type}
                      className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-700"
                    >
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-400"
                        checked={field.value.includes(type)}
                        onChange={(e) =>
                          field.onChange(
                            e.target.checked
                              ? [...field.value, type]
                              : field.value.filter((t) => t !== type),
                          )
                        }
                      />
                      {partnerTypeLabel[type]}
                    </label>
                  ))}
                </div>
              )}
            />
            {errors.partnerTypes && (
              <p className="text-xs text-red-600">
                {errors.partnerTypes.message}
              </p>
            )}
            <p className="text-xs text-slate-500">
              Một đối tác có thể vừa là thầu phụ vừa là nhà cung cấp.
            </p>
          </div>
          <div className="space-y-2">
            <Label>Mã đối tác *</Label>
            <Input {...register('code')} />
            {errors.code && (
              <p className="text-xs text-red-600">{errors.code.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Tên đối tác *</Label>
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
