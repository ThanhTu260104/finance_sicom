'use client';

import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { projectAssignmentsApi } from '@/lib/api';
import {
  isValidOptionalDate,
  normalizeOptionalDate,
} from '@/lib/csv';
import { formatDate, toDateInputValue } from '@/lib/format';
import {
  CsvDataTransfer,
  type CsvColumn,
} from '@/components/shared/csv-data-transfer';
import {
  assignmentQuantity,
  sumAssignmentQuantity,
} from '@/lib/project-assignment-cost';
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
  role: z.enum([
    'PROJECT_MANAGER',
    'PROJECT_COORDINATOR',
    'FINANCE',
    'OTHER',
  ]),
  quantity: z
    .string()
    .min(1, 'Bắt buộc')
    .refine((v) => {
      const n = Number(v.replace(/,/g, '').trim());
      return Number.isInteger(n) && n >= 0;
    }, 'Số lượng là số nguyên ≥ 0'),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  note: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

const ASSIGNMENT_CSV_COLUMNS: readonly CsvColumn[] = [
  {
    key: 'role',
    header: 'VaiTro',
    aliases: ['Vai trò', 'role'],
    required: true,
    sample: 'PROJECT_MANAGER',
    type: 'select',
    options: PROJECT_ASSIGNMENT_ROLES.map((role) => ({
      value: role,
      label: assignmentRoleLabel[role],
    })),
  },
  {
    key: 'quantity',
    header: 'SoLuong',
    aliases: ['Số lượng', 'quantity', 'so luong'],
    required: true,
    sample: '2',
  },
  {
    key: 'startDate',
    header: 'NgayBatDau',
    aliases: ['Ngày bắt đầu', 'startDate'],
    sample: '2026-01-01',
    type: 'date',
  },
  {
    key: 'endDate',
    header: 'NgayKetThuc',
    aliases: ['Ngày kết thúc', 'endDate'],
    sample: '',
    type: 'date',
  },
  {
    key: 'note',
    header: 'GhiChu',
    aliases: ['Ghi chú', 'note'],
    sample: '',
  },
];

function normalizeAssignmentRole(value: string): FormValues['role'] | null {
  const raw = value.trim().toUpperCase();
  if (!raw) return null;
  return (PROJECT_ASSIGNMENT_ROLES as readonly string[]).includes(raw)
    ? (raw as FormValues['role'])
    : null;
}

function toIsoDateOptional(value: string): string | undefined {
  const normalized = normalizeOptionalDate(value);
  if (!normalized) return undefined;
  return new Date(`${normalized}T00:00:00.000Z`).toISOString();
}

export function ProjectAssignmentsSection({
  projectId,
  projectCode,
  initial,
}: {
  projectId: string;
  projectCode?: string;
  initial: ProjectAssignment[];
}) {
  const [items, setItems] = useState(initial);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      role: 'PROJECT_MANAGER',
      quantity: '1',
      startDate: '',
      endDate: '',
      note: '',
    },
  });

  const watchRole = watch('role');

  const totalHeadcount = useMemo(
    () => sumAssignmentQuantity(items),
    [items],
  );

  const openCreate = () => {
    setEditingId(null);
    reset({
      role: 'PROJECT_MANAGER',
      quantity: '1',
      startDate: '',
      endDate: '',
      note: '',
    });
    setShowForm(true);
  };

  const openEdit = (item: ProjectAssignment) => {
    setEditingId(item.id);
    reset({
      role: item.role,
      quantity: String(assignmentQuantity(item)),
      startDate: toDateInputValue(item.startDate),
      endDate: toDateInputValue(item.endDate),
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
      role: values.role,
      quantity: Number(values.quantity.replace(/,/g, '').trim()),
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

  const handleImportCsv = async (rows: Array<Record<string, string>>) => {
    await projectAssignmentsApi.bulkUpsert(
      projectId,
      rows.map((row) => ({
        role: normalizeAssignmentRole(row.role)!,
        quantity: Number(row.quantity.replace(/,/g, '').trim() || '0'),
        startDate: toIsoDateOptional(row.startDate ?? ''),
        endDate: toIsoDateOptional(row.endDate ?? ''),
        note: row.note?.trim() || undefined,
      })),
    );
    await reload();
  };

  const handleDelete = async (id: string) => {
    try {
      await projectAssignmentsApi.remove(id);
      toast.success('Đã xóa dòng nhân sự');
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Xóa thất bại');
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <div>
          <CardTitle className="text-base">Nhân sự phụ trách</CardTitle>
          <p className="mt-1 text-xs text-slate-500">
            Số lượng theo vai trò trên dự án (không nhập lương/chi phí tại
            đây).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CsvDataTransfer
            title="nhân sự dự án"
            filenamePrefix={
              projectCode
                ? `nhan-su-${projectCode.replace(/[^\w-]+/g, '_')}`
                : 'nhan-su-du-an'
            }
            columns={ASSIGNMENT_CSV_COLUMNS}
            sampleRows={[
              {
                role: 'PROJECT_MANAGER',
                quantity: '1',
                startDate: '2026-01-01',
                endDate: '',
                note: 'File mau',
              },
              {
                role: 'PROJECT_COORDINATOR',
                quantity: '3',
                startDate: '',
                endDate: '',
                note: '',
              },
            ]}
            exportRows={items.map((item) => ({
              role: item.role,
              quantity: String(assignmentQuantity(item)),
              startDate: toDateInputValue(item.startDate),
              endDate: toDateInputValue(item.endDate),
              note: item.note ?? '',
            }))}
            validateRow={(row) => {
              const errors: string[] = [];
              if (!row.role?.trim()) errors.push('Thiếu vai trò (*)');
              else if (normalizeAssignmentRole(row.role) == null) {
                errors.push(
                  `Vai trò: ${PROJECT_ASSIGNMENT_ROLES.join(' | ')}`,
                );
              }
              const q = row.quantity?.replace(/,/g, '').trim();
              if (!q) errors.push('Thiếu số lượng (*)');
              else {
                const n = Number(q);
                if (!Number.isInteger(n) || n < 0) {
                  errors.push('Số lượng: số nguyên ≥ 0');
                }
              }
              if (
                row.startDate?.trim() &&
                !isValidOptionalDate(row.startDate)
              ) {
                errors.push('Ngày bắt đầu: yyyy-mm-dd');
              }
              if (row.endDate?.trim() && !isValidOptionalDate(row.endDate)) {
                errors.push('Ngày kết thúc: yyyy-mm-dd');
              }
              return errors;
            }}
            onImport={handleImportCsv}
            className="shrink-0"
          />
          <Button size="sm" onClick={openCreate}>
            Thêm vai trò
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {showForm && (
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50/80 p-4 md:grid-cols-2"
          >
            <div className="space-y-2">
              <Label>Vai trò *</Label>
              <Select {...register('role')} disabled={Boolean(editingId)}>
                {PROJECT_ASSIGNMENT_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {assignmentRoleLabel[role]}
                  </option>
                ))}
              </Select>
              {editingId ? (
                <p className="text-xs text-slate-500">
                  Không đổi vai trò khi sửa — xóa và thêm mới nếu cần vai trò
                  khác.
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label>Số lượng *</Label>
              <Input
                {...register('quantity')}
                inputMode="numeric"
                placeholder="VD: 2"
              />
              {errors.quantity && (
                <p className="text-xs text-red-600">
                  {errors.quantity.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Ngày bắt đầu</Label>
              <Input type="date" {...register('startDate')} />
            </div>
            <div className="space-y-2">
              <Label>Ngày kết thúc</Label>
              <Input type="date" {...register('endDate')} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>
                {watchRole === 'PROJECT_MANAGER'
                  ? 'Trưởng dự án (họ tên)'
                  : 'Ghi chú'}
              </Label>
              <Input
                {...register('note')}
                placeholder={
                  watchRole === 'PROJECT_MANAGER'
                    ? 'VD: Nguyễn Văn A'
                    : undefined
                }
              />
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
          <p className="text-sm text-slate-500">
            Chưa khai báo nhân sự theo vai trò.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vai trò</TableHead>
                  <TableHead>Số lượng</TableHead>
                  <TableHead>Ngày bắt đầu</TableHead>
                  <TableHead>Ngày kết thúc</TableHead>
                  <TableHead>Ghi chú</TableHead>
                  <TableHead className="text-right">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      {assignmentRoleLabel[item.role] ?? item.role}
                    </TableCell>
                    <TableCell className="font-medium tabular-nums">
                      {assignmentQuantity(item)}
                    </TableCell>
                    <TableCell>{formatDate(item.startDate)}</TableCell>
                    <TableCell>{formatDate(item.endDate)}</TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {item.note || '—'}
                    </TableCell>
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
                          title="Xóa dòng nhân sự?"
                          description="Xóa khai báo vai trò này khỏi dự án."
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-slate-50/80">
                  <TableCell className="font-medium">
                    Tổng số nhân sự
                  </TableCell>
                  <TableCell className="font-semibold tabular-nums">
                    {totalHeadcount}
                  </TableCell>
                  <TableCell colSpan={4} />
                </TableRow>
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
