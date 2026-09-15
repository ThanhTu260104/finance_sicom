'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { toast } from 'sonner';
import { customersApi } from '@/lib/api';
import type { Customer, CustomerStatus } from '@/lib/types';
import { CUSTOMER_STATUSES } from '@/lib/types';
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
import { CustomerStatusBadge } from '@/components/shared/status-badges';
import { ConfirmDeleteButton } from '@/components/shared/confirm-delete-button';
import { CsvDataTransfer } from '@/components/shared/csv-data-transfer';
import { PaginationBar } from '@/components/shared/pagination-bar';
import { QueryState } from '@/components/shared/query-state';
import { CustomerForm } from '@/components/customers/customer-form';
import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { CollapsibleFilters } from '@/components/shared/collapsible-filters';

const PAGE_SIZE = 10;

const customerStatusLabel: Record<CustomerStatus, string> = {
  ACTIVE: 'Hoạt động',
  INACTIVE: 'Ngừng',
};

const CUSTOMER_CSV_COLUMNS = [
  {
    key: 'code',
    header: 'MaKH',
    aliases: ['code', 'Mã KH', 'ma kh'],
    required: true,
    sample: 'KH001',
  },
  {
    key: 'name',
    header: 'TenKH',
    aliases: ['name', 'Tên KH', 'ten kh'],
    required: true,
    sample: 'Cong ty ABC',
  },
  {
    key: 'taxCode',
    header: 'MST',
    aliases: ['taxCode', 'Mã số thuế', 'mst'],
    sample: '0123456789',
  },
  {
    key: 'address',
    header: 'DiaChi',
    aliases: ['address', 'Địa chỉ', 'dia chi'],
    sample: 'Ha Noi',
  },
  {
    key: 'contactName',
    header: 'NguoiLH',
    aliases: ['contactName', 'Người liên hệ', 'nguoi lh'],
    sample: 'Nguyen Van A',
  },
  {
    key: 'contactPhone',
    header: 'SDT',
    aliases: ['contactPhone', 'Số điện thoại', 'sdt'],
    sample: '0901234567',
  },
  {
    key: 'contactEmail',
    header: 'Email',
    aliases: ['contactEmail', 'Email', 'email'],
    sample: 'contact@abc.com',
  },
  {
    key: 'status',
    header: 'TrangThai',
    aliases: ['status', 'Trạng thái'],
    sample: 'ACTIVE',
    type: 'select' as const,
    options: CUSTOMER_STATUSES.map((s) => ({
      value: s,
      label: customerStatusLabel[s],
    })),
  },
  {
    key: 'note',
    header: 'GhiChu',
    aliases: ['note', 'Ghi chú'],
    sample: 'Khach hang mau',
  },
];

function normalizeCustomerStatus(value: string): CustomerStatus | null {
  const raw = value.trim().toUpperCase();
  if (!raw) return 'ACTIVE';
  return (CUSTOMER_STATUSES as readonly string[]).includes(raw)
    ? (raw as CustomerStatus)
    : null;
}

export default function CustomersPage() {
  const [data, setData] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [mode, setMode] = useState<'list' | 'create' | 'edit'>('list');
  const [editing, setEditing] = useState<Customer | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await customersApi.list({
        search,
        page,
        limit: PAGE_SIZE,
        sortBy: 'code',
        sortOrder: 'asc',
      });
      setData(res.data);
      setTotal(res.meta.total);
      setTotalPages(res.meta.totalPages);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Không tải được khách hàng';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [search, page]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 250);
    return () => clearTimeout(timer);
  }, [load]);

  const handleImportCsv = async (rows: Array<Record<string, string>>) => {
    await customersApi.bulkUpsert(
      rows.map((row) => ({
        code: row.code.trim(),
        name: row.name.trim(),
        taxCode: row.taxCode?.trim() || undefined,
        address: row.address?.trim() || undefined,
        contactName: row.contactName?.trim() || undefined,
        contactPhone: row.contactPhone?.trim() || undefined,
        contactEmail: row.contactEmail?.trim() || undefined,
        status: normalizeCustomerStatus(row.status ?? '') ?? 'ACTIVE',
        note: row.note?.trim() || undefined,
      })),
    );
    await load();
  };

  const handleDelete = async (id: string) => {
    try {
      await customersApi.remove(id);
      toast.success('Đã xóa khách hàng');
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Xóa thất bại');
    }
  };

  if (mode === 'create') {
    return (
      <div className="space-y-4">
        <Breadcrumbs
          items={[
            { label: 'Quản lý dự án' },
            { label: 'Khách hàng', href: '/customers' },
            { label: 'Thêm khách hàng' },
          ]}
        />
        <h2 className="font-serif text-2xl font-semibold">Thêm khách hàng</h2>
        <CustomerForm
          onSuccess={() => {
            setMode('list');
            load();
          }}
          onCancel={() => setMode('list')}
        />
      </div>
    );
  }

  if (mode === 'edit' && editing) {
    return (
      <div className="space-y-4">
        <Breadcrumbs
          items={[
            { label: 'Quản lý dự án' },
            { label: 'Khách hàng', href: '/customers' },
            { label: editing.code },
          ]}
        />
        <h2 className="font-serif text-2xl font-semibold">Sửa khách hàng</h2>
        <CustomerForm
          customerId={editing.id}
          initial={editing}
          onSuccess={() => {
            setMode('list');
            setEditing(null);
            load();
          }}
          onCancel={() => {
            setMode('list');
            setEditing(null);
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Breadcrumbs
        items={[
          { label: 'Quản lý dự án' },
          { label: 'Khách hàng', href: '/customers' },
        ]}
      />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-serif text-2xl font-semibold">Khách hàng</h2>
          <p className="text-sm text-slate-500">
            Quản lý thông tin khách hàng gắn với dự án
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CsvDataTransfer
            title="khách hàng"
            filenamePrefix="khach-hang"
            columns={CUSTOMER_CSV_COLUMNS}
            sampleRows={[
              {
                code: 'KH001',
                name: 'Cong ty ABC',
                taxCode: '0123456789',
                address: 'Ha Noi',
                contactName: 'Nguyen Van A',
                contactPhone: '0901234567',
                contactEmail: 'contact@abc.com',
                status: 'ACTIVE',
                note: 'File mau import',
              },
            ]}
            exportRows={data.map((item) => ({
              code: item.code,
              name: item.name,
              taxCode: item.taxCode ?? '',
              address: item.address ?? '',
              contactName: item.contactName ?? '',
              contactPhone: item.contactPhone ?? '',
              contactEmail: item.contactEmail ?? '',
              status: item.status,
              note: item.note ?? '',
            }))}
            validateRow={(row) => {
              const errors: string[] = [];
              if (!row.code?.trim()) errors.push('Thiếu mã KH');
              if (!row.name?.trim()) errors.push('Thiếu tên KH');
              if (
                row.status?.trim() &&
                normalizeCustomerStatus(row.status) == null
              ) {
                errors.push('Trạng thái: ACTIVE | INACTIVE');
              }
              return errors;
            }}
            onImport={handleImportCsv}
          />
          <Button onClick={() => setMode('create')}>
            <Plus className="h-4 w-4" />
            Thêm khách hàng
          </Button>
        </div>
      </div>

      <CollapsibleFilters title="Tìm kiếm">
        <div className="relative max-w-xl">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            className="pl-9"
            placeholder="Tìm mã, tên, MST, người liên hệ..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
      </CollapsibleFilters>

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <QueryState
            loading={loading}
            error={error}
            empty={data.length === 0}
            emptyMessage="Chưa có khách hàng nào."
            emptyAction={
              <Button variant="outline" onClick={() => setMode('create')}>
                Tạo khách hàng đầu tiên
              </Button>
            }
            onRetry={load}
          >
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mã KH</TableHead>
                    <TableHead>Tên khách hàng</TableHead>
                    <TableHead>Mã số thuế</TableHead>
                    <TableHead>Người liên hệ</TableHead>
                    <TableHead>Số điện thoại</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead className="text-right">Thao tác</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((customer) => (
                    <TableRow key={customer.id}>
                      <TableCell className="font-medium">
                        {customer.code}
                      </TableCell>
                      <TableCell>{customer.name}</TableCell>
                      <TableCell>{customer.taxCode || '—'}</TableCell>
                      <TableCell>{customer.contactName || '—'}</TableCell>
                      <TableCell>{customer.contactPhone || '—'}</TableCell>
                      <TableCell>{customer.contactEmail || '—'}</TableCell>
                      <TableCell>
                        <CustomerStatusBadge status={customer.status} />
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              setEditing(customer);
                              setMode('edit');
                            }}
                          >
                            Sửa
                          </Button>
                          <ConfirmDeleteButton
                            onConfirm={() => handleDelete(customer.id)}
                            title="Xóa khách hàng?"
                            description={`Xóa mềm khách hàng ${customer.code}.`}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <PaginationBar
              page={page}
              totalPages={totalPages}
              total={total}
              onPageChange={setPage}
            />
          </QueryState>
        </CardContent>
      </Card>
    </div>
  );
}
