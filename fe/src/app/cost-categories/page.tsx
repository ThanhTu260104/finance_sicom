'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { costCategoriesApi } from '@/lib/api';
import type { CostCategory, EmployeeStatus } from '@/lib/types';
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
import { CostCategoryForm } from '@/components/cost-categories/cost-category-form';
import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { Select } from '@/components/ui/select';
import { WriteOnly } from '@/components/auth/auth-provider';

const statusLabel: Record<EmployeeStatus, string> = {
  ACTIVE: 'Đang dùng',
  INACTIVE: 'Ngừng',
};

const CSV_COLUMNS: readonly CsvColumn[] = [
  {
    key: 'code',
    header: 'MaLoai',
    aliases: ['Mã loại', 'code', 'ma loai'],
    required: true,
    sample: 'CP_PHAT_SINH',
  },
  {
    key: 'name',
    header: 'TenLoai',
    aliases: ['Tên loại', 'name'],
    required: true,
    sample: 'Chi phi phat sinh',
  },
  {
    key: 'sortOrder',
    header: 'ThuTu',
    aliases: ['Thứ tự', 'sortOrder'],
    sample: '50',
  },
  {
    key: 'status',
    header: 'TrangThai',
    aliases: ['status'],
    sample: 'ACTIVE',
    type: 'select',
    options: EMPLOYEE_STATUSES.map((s) => ({
      value: s,
      label: statusLabel[s],
    })),
  },
  { key: 'note', header: 'GhiChu', aliases: ['note'], sample: '' },
];

function normalizeStatus(value: string): EmployeeStatus | null {
  const raw = value.trim().toUpperCase();
  if (!raw) return 'ACTIVE';
  return (EMPLOYEE_STATUSES as readonly string[]).includes(raw)
    ? (raw as EmployeeStatus)
    : null;
}

export default function CostCategoriesPage() {
  const [items, setItems] = useState<CostCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<EmployeeStatus | ''>('ACTIVE');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<CostCategory | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await costCategoriesApi.listAll({
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

  const handleImport = async (rows: Array<Record<string, string>>) => {
    await costCategoriesApi.bulkUpsert(
      rows.map((row) => ({
        code: row.code.trim(),
        name: row.name.trim(),
        sortOrder: row.sortOrder?.trim() ? Number(row.sortOrder) : 0,
        status: normalizeStatus(row.status ?? '') ?? 'ACTIVE',
        note: row.note?.trim() || undefined,
      })),
    );
    await load();
  };

  return (
    <div className="space-y-4">
      <Breadcrumbs
        items={[{ label: 'Quản lý dự án' }, { label: 'Loại chi phí' }]}
      />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-serif text-2xl font-semibold">Loại chi phí</h2>
          <p className="text-sm text-slate-500">
            Danh mục dùng khi ghi{' '}
            <Link href="/projects" className="underline-offset-2 hover:underline">
              bảng chi phí dự án
            </Link>
            . Thêm mã mới bất cứ lúc nào.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <CsvDataTransfer
            title="loại chi phí"
            filenamePrefix="loai-chi-phi"
            columns={CSV_COLUMNS}
            sampleRows={[
              {
                code: 'CP_PHAT_SINH',
                name: 'Chi phi phat sinh',
                sortOrder: '100',
                status: 'ACTIVE',
                note: '',
              },
            ]}
            exportRows={items.map((row) => ({
              code: row.code,
              name: row.name,
              sortOrder: String(row.sortOrder),
              status: row.status,
              note: row.note ?? '',
            }))}
            validateRow={(row) => {
              const errors: string[] = [];
              if (!row.code?.trim()) errors.push('Thiếu mã loại');
              if (!row.name?.trim()) errors.push('Thiếu tên loại');
              if (row.status?.trim() && normalizeStatus(row.status) == null) {
                errors.push('Trạng thái: ACTIVE | INACTIVE');
              }
              return errors;
            }}
            onImport={handleImport}
          />
          <WriteOnly>
            <Button
              onClick={() => {
                setEditing(null);
                setShowForm(true);
              }}
            >
              <Plus className="h-4 w-4" />
              Thêm loại
            </Button>
          </WriteOnly>
        </div>
      </div>

      {showForm && (
        <CostCategoryForm
          categoryId={editing?.id}
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
              placeholder="Tìm mã, tên loại…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select
            value={status}
            onChange={(e) => setStatus(e.target.value as EmployeeStatus | '')}
            className="sm:w-44"
          >
            <option value="">Tất cả</option>
            {EMPLOYEE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {statusLabel[s]}
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
        emptyMessage="Chưa có loại chi phí."
        onRetry={load}
      >
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mã</TableHead>
                <TableHead>Tên loại</TableHead>
                <TableHead>TT</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead className="text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-mono text-xs">{row.code}</TableCell>
                  <TableCell>{row.name}</TableCell>
                  <TableCell>{row.sortOrder}</TableCell>
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
                        onConfirm={async () => {
                          try {
                            await costCategoriesApi.remove(row.id);
                            toast.success('Đã xóa loại chi phí');
                            await load();
                          } catch (err) {
                            toast.error(
                              err instanceof Error ? err.message : 'Xóa thất bại',
                            );
                          }
                        }}
                        title="Xóa loại chi phí?"
                        description="Không xóa được nếu đã có dòng chi phí dự án."
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </QueryState>
    </div>
  );
}
