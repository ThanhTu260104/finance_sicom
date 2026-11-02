'use client';

import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { companiesApi } from '@/lib/api';
import type { Company } from '@/lib/types';
import { CUSTOMER_STATUSES } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { CustomerStatusBadge } from '@/components/shared/status-badges';
import { ConfirmDeleteButton } from '@/components/shared/confirm-delete-button';
import { QueryState } from '@/components/shared/query-state';
import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { WriteOnly } from '@/components/auth/auth-provider';

const schema = z.object({
  code: z.string().trim().min(1, 'Bắt buộc').max(50, 'Tối đa 50 ký tự'),
  name: z.string().trim().min(1, 'Bắt buộc').max(255, 'Tối đa 255 ký tự'),
  taxCode: z.string().optional(),
  address: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']),
  note: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

function CompanyForm({
  initial,
  onSuccess,
  onCancel,
}: {
  initial?: Company;
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
      taxCode: initial?.taxCode ?? '',
      address: initial?.address ?? '',
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
      status: values.status,
      note: values.note || undefined,
    };
    try {
      if (initial) {
        await companiesApi.update(initial.id, payload);
        toast.success('Cập nhật công ty thành công');
      } else {
        await companiesApi.create(payload);
        toast.success('Tạo công ty thành công');
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
          {initial ? `Sửa công ty ${initial.code}` : 'Thêm công ty'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="grid gap-4 md:grid-cols-2"
        >
          <div className="space-y-2">
            <Label>Mã công ty *</Label>
            <Input {...register('code')} placeholder="vd. SICOM" />
            {errors.code && (
              <p className="text-xs text-red-600">{errors.code.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Tên công ty *</Label>
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

export default function CompaniesPage() {
  const [items, setItems] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'list' | 'create' | 'edit'>('list');
  const [editing, setEditing] = useState<Company | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await companiesApi.list({ limit: 100 });
      setItems(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được công ty');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const backToList = () => {
    setMode('list');
    setEditing(null);
  };

  const handleDelete = async (company: Company) => {
    try {
      await companiesApi.remove(company.id);
      toast.success(`Đã xóa công ty ${company.code}`);
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Xóa thất bại');
    }
  };

  return (
    <div className="space-y-4">
      <Breadcrumbs
        items={[
          { label: 'Quản lý dự án' },
          { label: 'Công ty', href: '/companies' },
        ]}
      />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-serif text-2xl font-semibold">Công ty</h2>
          <p className="text-sm text-slate-500">
            Các công ty trong nhóm — chọn công ty ký khi tạo từng hợp đồng
          </p>
        </div>
        {mode === 'list' ? (
          <WriteOnly>
            <Button onClick={() => setMode('create')}>
              <Plus className="h-4 w-4" />
              Thêm công ty
            </Button>
          </WriteOnly>
        ) : null}
      </div>

      {mode === 'create' ? (
        <CompanyForm
          onSuccess={() => {
            backToList();
            void load();
          }}
          onCancel={backToList}
        />
      ) : null}
      {mode === 'edit' && editing ? (
        <CompanyForm
          initial={editing}
          onSuccess={() => {
            backToList();
            void load();
          }}
          onCancel={backToList}
        />
      ) : null}

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <QueryState
            loading={loading}
            error={error}
            empty={items.length === 0}
            emptyMessage="Chưa có công ty nào. Thêm 3 công ty để chọn khi ký hợp đồng."
            onRetry={load}
          >
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mã</TableHead>
                    <TableHead>Tên công ty</TableHead>
                    <TableHead>Mã số thuế</TableHead>
                    <TableHead>Địa chỉ</TableHead>
                    <TableHead className="text-right">Số HĐ</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead className="text-right">Thao tác</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((company) => (
                    <TableRow key={company.id}>
                      <TableCell className="font-medium">{company.code}</TableCell>
                      <TableCell>{company.name}</TableCell>
                      <TableCell>{company.taxCode || '—'}</TableCell>
                      <TableCell>{company.address || '—'}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {company._count?.contracts ?? 0}
                      </TableCell>
                      <TableCell>
                        <CustomerStatusBadge status={company.status} />
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          <WriteOnly>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => {
                                setEditing(company);
                                setMode('edit');
                              }}
                            >
                              Sửa
                            </Button>
                          </WriteOnly>
                          <ConfirmDeleteButton
                            onConfirm={() => handleDelete(company)}
                            title="Xóa công ty?"
                            description={
                              (company._count?.contracts ?? 0) > 0
                                ? `Công ty ${company.code} đang gắn ${company._count?.contracts} HĐ — các HĐ vẫn giữ liên kết. Xóa mềm?`
                                : `Xóa mềm công ty ${company.code}.`
                            }
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
    </div>
  );
}
