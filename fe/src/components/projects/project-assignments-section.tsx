'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { projectAssignmentsApi } from '@/lib/api';
import { formatDate, toDateInputValue } from '@/lib/format';
import type { ProjectAssignment } from '@/lib/types';
import { PROJECT_ASSIGNMENT_ROLES } from '@/lib/types';
import { assignmentRoleLabel } from '@/components/shared/status-badges';
import { ConfirmDeleteButton } from '@/components/shared/confirm-delete-button';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const schema = z.object({
  employeeId: z.string().uuid('Employee ID phải là UUID'),
  role: z.enum([
    'PROJECT_MANAGER',
    'PROJECT_COORDINATOR',
    'FINANCE',
    'OTHER',
  ]),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  isPrimary: z.boolean().optional(),
  note: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export function ProjectAssignmentsSection({
  projectId,
  initial,
}: {
  projectId: string;
  initial: ProjectAssignment[];
}) {
  const [items, setItems] = useState(initial);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      employeeId: '',
      role: 'PROJECT_MANAGER',
      startDate: '',
      endDate: '',
      isPrimary: false,
      note: '',
    },
  });


  const openCreate = () => {
    setEditingId(null);
    reset({
      employeeId: '',
      role: 'PROJECT_MANAGER',
      startDate: '',
      endDate: '',
      isPrimary: false,
      note: '',
    });
    setShowForm(true);
  };

  const openEdit = (item: ProjectAssignment) => {
    setEditingId(item.id);
    reset({
      employeeId: item.employeeId,
      role: item.role,
      startDate: toDateInputValue(item.startDate),
      endDate: toDateInputValue(item.endDate),
      isPrimary: item.isPrimary,
      note: item.note ?? '',
    });
    setShowForm(true);
  };

  const reload = async () => {
    const data = await projectAssignmentsApi.list(projectId);
    setItems(data);
  };

  const onSubmit = async (values: FormValues) => {
    const payload = {
      employeeId: values.employeeId,
      role: values.role,
      isPrimary: values.isPrimary ?? false,
      note: values.note || undefined,
      startDate: values.startDate
        ? new Date(values.startDate).toISOString()
        : undefined,
      endDate: values.endDate
        ? new Date(values.endDate).toISOString()
        : undefined,
    };

    try {
      if (editingId) {
        await projectAssignmentsApi.update(editingId, payload);
        toast.success('Cập nhật nhân sự thành công');
      } else {
        await projectAssignmentsApi.create(projectId, payload);
        toast.success('Thêm nhân sự thành công');
      }
      setShowForm(false);
      setEditingId(null);
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Lưu thất bại');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await projectAssignmentsApi.remove(id);
      toast.success('Đã xóa nhân sự');
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Xóa thất bại');
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="text-base">Nhân sự phụ trách</CardTitle>
        <Button size="sm" onClick={openCreate}>
          Thêm nhân sự
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {showForm && (
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50/80 p-4 md:grid-cols-2"
          >
            <div className="space-y-2">
              <Label>Employee ID *</Label>
              <Input {...register('employeeId')} placeholder="UUID nhân sự" />
              <p className="text-xs text-slate-500">
                Backend chưa có API Employee — nhập UUID.
              </p>
              {errors.employeeId && (
                <p className="text-xs text-red-600">
                  {errors.employeeId.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Vai trò *</Label>
              <Select {...register('role')}>
                {PROJECT_ASSIGNMENT_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {assignmentRoleLabel[role]}
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
            <div className="flex items-center gap-2 md:col-span-2">
              <input
                id="isPrimary"
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300"
                {...register('isPrimary')}
              />
              <Label htmlFor="isPrimary">Phụ trách chính</Label>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Ghi chú</Label>
              <Input {...register('note')} />
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
                  setEditingId(null);
                }}
              >
                Hủy
              </Button>
            </div>
          </form>
        )}

        {items.length === 0 ? (
          <p className="text-sm text-slate-500">Chưa có nhân sự phụ trách.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nhân sự</TableHead>
                  <TableHead>Vai trò</TableHead>
                  <TableHead>Ngày bắt đầu</TableHead>
                  <TableHead>Ngày kết thúc</TableHead>
                  <TableHead>Phụ trách chính</TableHead>
                  <TableHead className="text-right">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono text-xs">
                      {item.employeeId}
                    </TableCell>
                    <TableCell>
                      {assignmentRoleLabel[item.role] ?? item.role}
                    </TableCell>
                    <TableCell>{formatDate(item.startDate)}</TableCell>
                    <TableCell>{formatDate(item.endDate)}</TableCell>
                    <TableCell>{item.isPrimary ? 'Có' : 'Không'}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => openEdit(item)}
                        >
                          Sửa
                        </Button>
                        <ConfirmDeleteButton
                          onConfirm={() => handleDelete(item.id)}
                          title="Xóa nhân sự?"
                          description="Xóa cứng phân công nhân sự khỏi dự án."
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
