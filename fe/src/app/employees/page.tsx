'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { employeesApi } from '@/lib/api';
import type { Employee, EmployeeStatus } from '@/lib/types';
import { EMPLOYEE_STATUSES } from '@/lib/types';
import {
  CsvDataTransfer,
  type CsvColumn,
} from '@/components/shared/csv-data-transfer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EmployeeStatusBadge } from '@/components/shared/status-badges';
import { ConfirmDeleteButton } from '@/components/shared/confirm-delete-button';
import { QueryState } from '@/components/shared/query-state';
import { EmployeeForm } from '@/components/employees/employee-form';
import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { Select } from '@/components/ui/select';
import { WriteOnly } from '@/components/auth/auth-provider';

const employeeStatusLabel: Record<EmployeeStatus, string> = {
  ACTIVE: 'Đang làm',
  INACTIVE: 'Ngừng',
};

const EMPLOYEE_CSV_COLUMNS: readonly CsvColumn[] = [
  {
    key: 'code',
    header: 'MaNV',
    aliases: ['code', 'Mã NV', 'ma nv'],
    required: true,
    sample: 'NV001',
  },
  {
    key: 'fullName',
    header: 'HoTen',
    aliases: ['fullName', 'Họ tên', 'ho ten', 'name'],
    required: true,
    sample: 'Nguyen Van A',
  },
  {
    key: 'jobTitle',
    header: 'ChucDanh',
    aliases: ['jobTitle', 'Chức danh', 'chuc danh'],
    sample: 'Ky su trien khai',
  },
  {
    key: 'status',
    header: 'TrangThai',
    aliases: ['status', 'Trạng thái'],
    sample: 'ACTIVE',
    type: 'select',
    options: EMPLOYEE_STATUSES.map((s) => ({
      value: s,
      label: employeeStatusLabel[s],
    })),
  },
  {
    key: 'note',
    header: 'GhiChu',
    aliases: ['note', 'Ghi chú'],
    sample: 'Nhan vien mau',
  },
];

function normalizeEmployeeStatus(value: string): EmployeeStatus | null {
  const raw = value.trim().toUpperCase();
  if (!raw) return 'ACTIVE';
  return (EMPLOYEE_STATUSES as readonly string[]).includes(raw)
    ? (raw as EmployeeStatus)
    : null;
}

export default function EmployeesPage() {
  const [items, setItems] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<EmployeeStatus | ''>('ACTIVE');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await employeesApi.listAll({
        search: search.trim() || undefined,
        status: status || undefined,
      });
      setItems(data);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Không tải được danh sách';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [search, status]);

  useEffect(() => {
    const t = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(t);
  }, [load]);

  const handleImportCsv = async (rows: Array<Record<string, string>>) => {
    await employeesApi.bulkUpsert(
      rows.map((row) => ({
        code: row.code.trim(),
        fullName: row.fullName.trim(),
        jobTitle: row.jobTitle?.trim() || undefined,
        status: normalizeEmployeeStatus(row.status ?? '') ?? 'ACTIVE',
        note: row.note?.trim() || undefined,
      })),
    );
    await load();
  };

  const handleDelete = async (id: string) => {
    try {
      await employeesApi.remove(id);
      toast.success('Đã xóa nhân viên');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Xóa thất bại');
    }
  };

  return (
    <div className="space-y-4">
      <Breadcrumbs
        items={[{ label: 'Quản lý dự án' }, { label: 'Nhân sự' }]}
      />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-serif text-2xl font-semibold">Danh mục nhân sự</h2>
          <p className="text-sm text-slate-500">
            Danh mục tham chiếu (tuỳ chọn). Phân bổ số lượng theo vai trò tại
            chi tiết dự án.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CsvDataTransfer
            title="nhân sự"
            filenamePrefix="nhan-su"
            columns={EMPLOYEE_CSV_COLUMNS}
            sampleRows={[
              {
                code: 'NV001',
                fullName: 'Nguyen Van A',
                jobTitle: 'PM',
                status: 'ACTIVE',
                note: 'File mau import',
              },
            ]}
            exportRows={items.map((item) => ({
              code: item.code,
              fullName: item.fullName,
              jobTitle: item.jobTitle ?? '',
              status: item.status,
              note: item.note ?? '',
            }))}
            validateRow={(row) => {
              const errors: string[] = [];
              if (!row.code?.trim()) errors.push('Thiếu mã NV (*)');
              if (!row.fullName?.trim()) errors.push('Thiếu họ tên (*)');
              if (row.code && row.code.trim().length > 50) {
                errors.push('Mã NV tối đa 50 ký tự');
              }
              if (row.fullName && row.fullName.trim().length > 255) {
                errors.push('Họ tên tối đa 255 ký tự');
              }
              if (
                row.status?.trim() &&
                normalizeEmployeeStatus(row.status) == null
              ) {
                errors.push('Trạng thái: ACTIVE | INACTIVE');
              }
              return errors;
            }}
            onImport={handleImportCsv}
          />
          <WriteOnly>
            <Button
              onClick={() => {
                setEditing(null);
                setShowForm(true);
              }}
            >
              <Plus className="h-4 w-4" />
              Thêm nhân viên
            </Button>
          </WriteOnly>
        </div>
      </div>

      {showForm && (
        <EmployeeForm
          employeeId={editing?.id}
          initial={editing ?? undefined}
          onSuccess={() => {
            setShowForm(false);
            setEditing(null);
            void load();
          }}
          onCancel={() => {
            setShowForm(false);
            setEditing(null);
          }}
        />
      )}

      <Card>
        <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              className="pl-9"
              placeholder="Tìm mã, tên, chức danh…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select
            value={status}
            onChange={(e) => setStatus(e.target.value as EmployeeStatus | '')}
            className="sm:w-44"
          >
            <option value="">Tất cả trạng thái</option>
            {EMPLOYEE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s === 'ACTIVE' ? 'Đang làm' : 'Ngừng'}
              </option>
            ))}
          </Select>
          <Button variant="secondary" onClick={() => void load()}>
            Tìm
          </Button>
        </CardContent>
      </Card>

      <QueryState
        loading={loading}
        error={error}
        empty={items.length === 0}
        emptyMessage="Chưa có nhân viên."
        onRetry={load}
      >
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mã NV</TableHead>
                <TableHead>Họ tên</TableHead>
                <TableHead>Chức danh</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead className="text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.code}</TableCell>
                  <TableCell>{row.fullName}</TableCell>
                  <TableCell>{row.jobTitle || '—'}</TableCell>
                  <TableCell>
                    <EmployeeStatusBadge status={row.status} />
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <WriteOnly>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setEditing(row);
                            setShowForm(true);
                          }}
                        >
                          Sửa
                        </Button>
                      </WriteOnly>
                      <ConfirmDeleteButton
                        onConfirm={() => handleDelete(row.id)}
                        title="Xóa nhân viên?"
                        description="Xóa mềm nhân viên khỏi danh mục."
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <p className="text-xs text-slate-500">
          Phân công nhân sự vào từng dự án tại{' '}
          <Link href="/projects" className="underline-offset-2 hover:underline">
            chi tiết dự án
          </Link>
          .
        </p>
      </QueryState>
    </div>
  );
}
