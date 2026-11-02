'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Plus, Search } from 'lucide-react';
import { toast } from 'sonner';
import { customersApi } from '@/lib/api';
import type { Customer, CustomerStatus, PartnerType } from '@/lib/types';
import { CUSTOMER_STATUSES, PARTNER_TYPES } from '@/lib/types';
import { partnerTypeLabel } from '@/lib/contract-kind';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
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
import { ColumnVisibilityMenu } from '@/components/shared/column-visibility-menu';
import { InfiniteScrollFooter } from '@/components/shared/infinite-scroll-footer';
import { QueryState } from '@/components/shared/query-state';
import {
  TableBulkActionBar,
  TableCellCheckbox,
  TableHeadCheckbox,
} from '@/components/shared/table-selection';
import { useInfinitePaginatedList } from '@/hooks/use-infinite-paginated-list';
import { useTableSelection } from '@/hooks/use-table-selection';
import {
  useColumnVisibility,
  type ColumnDef,
} from '@/hooks/use-column-visibility';
import { CustomerForm } from '@/components/customers/customer-form';
import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { CollapsibleFilters } from '@/components/shared/collapsible-filters';
import { fetchAllPaginated } from '@/lib/fetch-all-paginated';
import { WriteOnly } from '@/components/auth/auth-provider';

type CustomerCol =
  | 'code'
  | 'name'
  | 'taxCode'
  | 'contactName'
  | 'contactPhone'
  | 'contactEmail'
  | 'partnerTypes'
  | 'status'
  | 'actions';

const CUSTOMER_COLUMNS: ColumnDef<CustomerCol>[] = [
  { key: 'code', label: 'Mã', locked: true },
  { key: 'name', label: 'Tên đối tác', locked: true },
  { key: 'taxCode', label: 'Mã số thuế' },
  { key: 'contactName', label: 'Người liên hệ' },
  { key: 'contactPhone', label: 'Số điện thoại' },
  { key: 'contactEmail', label: 'Email' },
  { key: 'partnerTypes', label: 'Loại đối tác' },
  { key: 'status', label: 'Trạng thái' },
  { key: 'actions', label: 'Thao tác', locked: true },
];

const customerStatusLabel: Record<CustomerStatus, string> = {
  ACTIVE: 'Hoạt động',
  INACTIVE: 'Ngừng',
};

const partnerTabDescription: Record<PartnerType, string> = {
  INVESTOR: 'Chủ đầu tư (bệnh viện…) — bên trả tiền, gắn với dự án',
  SUBCONTRACTOR: 'Nhà thầu phụ — công ty chi tiền theo HĐ thầu phụ',
  SUPPLIER: 'Nhà cung cấp — công ty chi tiền theo HĐ cung cấp',
};

function parsePartnerType(value: string | null): PartnerType {
  return (PARTNER_TYPES as readonly string[]).includes(value ?? '')
    ? (value as PartnerType)
    : 'INVESTOR';
}

/** "INVESTOR;SUPPLIER" → mảng hợp lệ; rỗng → null (dùng tab hiện tại) */
function parsePartnerTypesCell(value: string): PartnerType[] | null {
  const parts = value
    .split(/[;,]/)
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  if (parts.length === 0) return null;
  if (parts.some((p) => !(PARTNER_TYPES as readonly string[]).includes(p))) {
    return null;
  }
  return [...new Set(parts)] as PartnerType[];
}

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
  {
    key: 'partnerTypes',
    header: 'LoaiDoiTac',
    aliases: ['partnerTypes', 'Loại đối tác', 'loai doi tac'],
    sample: 'INVESTOR',
    type: 'multi-select' as const,
    multiSeparator: ';',
    options: PARTNER_TYPES.map((t) => ({
      value: t,
      label: partnerTypeLabel[t],
    })),
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
  return (
    <Suspense fallback={<div className="p-8 text-slate-500">Đang tải...</div>}>
      <PartnersPageContent />
    </Suspense>
  );
}

function PartnersPageContent() {
  const searchParams = useSearchParams();
  const partnerType = parsePartnerType(searchParams.get('type'));
  // key: đổi tab → reset form / tìm kiếm / lựa chọn
  return <PartnersTab key={partnerType} partnerType={partnerType} />;
}

function PartnerTypeTabs({ active }: { active: PartnerType }) {
  return (
    <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
      {PARTNER_TYPES.map((type) => (
        <Link
          key={type}
          href={type === 'INVESTOR' ? '/customers' : `/customers?type=${type}`}
          className={cn(
            'rounded-md px-3 py-2 text-sm font-medium transition-colors',
            active === type
              ? 'bg-slate-900 text-white'
              : 'bg-white text-slate-700 hover:bg-slate-100',
          )}
        >
          {partnerTypeLabel[type]}
        </Link>
      ))}
    </div>
  );
}

function PartnersTab({ partnerType }: { partnerType: PartnerType }) {
  const tabLabel = partnerTypeLabel[partnerType];
  const [search, setSearch] = useState('');
  const [mode, setMode] = useState<'list' | 'create' | 'edit'>('list');
  const [editing, setEditing] = useState<Customer | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const fetchPage = useCallback(
    (page: number, limit: number) =>
      customersApi.list({
        search,
        partnerType,
        page,
        limit,
        sortBy: 'code',
        sortOrder: 'asc',
      }),
    [search, partnerType],
  );

  const {
    data,
    loading,
    loadingMore,
    error,
    total,
    hasMore,
    loadMore,
    reload,
  } = useInfinitePaginatedList<Customer>({
    fetchPage,
    resetDeps: [search, partnerType],
  });

  const {
    selectedIds,
    selectedCount,
    allSelected,
    someSelected,
    toggleAll,
    toggleOne,
    clearSelection,
  } = useTableSelection(data);

  const columns = useMemo(() => CUSTOMER_COLUMNS, []);
  const { isVisible, toggle, showAll, reset } = useColumnVisibility(
    'table-cols:customers',
    columns,
  );

  useEffect(() => {
    if (error) toast.error(error);
  }, [error]);

  const exportAllCustomers = useCallback(async () => {
    const items = await fetchAllPaginated((page, limit) =>
      customersApi.list({
        search,
        partnerType,
        page,
        limit,
        sortBy: 'code',
        sortOrder: 'asc',
      }),
    );
    return items.map((item) => ({
      code: item.code,
      name: item.name,
      taxCode: item.taxCode ?? '',
      address: item.address ?? '',
      contactName: item.contactName ?? '',
      contactPhone: item.contactPhone ?? '',
      contactEmail: item.contactEmail ?? '',
      status: item.status,
      note: item.note ?? '',
      partnerTypes: (item.partnerTypes ?? []).join(';'),
    }));
  }, [search, partnerType]);

  const handleImportCsv = async (rows: Array<Record<string, string>>) => {
    const result = await customersApi.bulkUpsert(
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
        // Trống → gán loại của tab đang nhập; mã đã có thì gộp thêm loại
        partnerTypes: parsePartnerTypesCell(row.partnerTypes ?? '') ?? [
          partnerType,
        ],
      })),
    );
    toast.success(
      `Đã nhập ${result.count} ${tabLabel.toLowerCase()} (${result.created} mới, ${result.updated} cập nhật)`,
    );
    await reload();
  };

  /** Đối tác thuộc nhiều nhóm → chỉ gỡ nhóm của tab; nhóm cuối cùng → xóa mềm */
  const removeFromTab = (customer: Customer) => {
    const remaining = (customer.partnerTypes ?? []).filter(
      (t) => t !== partnerType,
    );
    return remaining.length > 0
      ? customersApi.update(customer.id, { partnerTypes: remaining })
      : customersApi.remove(customer.id);
  };

  const handleDelete = async (customer: Customer) => {
    try {
      await removeFromTab(customer);
      toast.success(`Đã xóa ${tabLabel.toLowerCase()} ${customer.code}`);
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Xóa thất bại');
    }
  };

  const handleBulkDelete = async () => {
    const selected = data.filter((c) => selectedIds.has(c.id));
    if (selected.length === 0) return;
    setBulkDeleting(true);
    try {
      await Promise.all(selected.map((c) => removeFromTab(c)));
      toast.success(`Đã xóa ${selected.length} ${tabLabel.toLowerCase()}`);
      clearSelection();
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Xóa thất bại');
    } finally {
      setBulkDeleting(false);
    }
  };

  const tabHref =
    partnerType === 'INVESTOR' ? '/customers' : `/customers?type=${partnerType}`;

  if (mode === 'create') {
    return (
      <div className="space-y-4">
        <Breadcrumbs
          items={[
            { label: 'Quản lý dự án' },
            { label: 'Đối tác', href: '/customers' },
            { label: tabLabel, href: tabHref },
            { label: `Thêm ${tabLabel.toLowerCase()}` },
          ]}
        />
        <h2 className="font-serif text-2xl font-semibold">
          Thêm {tabLabel.toLowerCase()}
        </h2>
        <CustomerForm
          defaultPartnerType={partnerType}
          onSuccess={() => {
            setMode('list');
            reload();
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
            { label: 'Đối tác', href: '/customers' },
            { label: tabLabel, href: tabHref },
            { label: editing.code },
          ]}
        />
        <h2 className="font-serif text-2xl font-semibold">Sửa đối tác</h2>
        <CustomerForm
          defaultPartnerType={partnerType}
          customerId={editing.id}
          initial={editing}
          onSuccess={() => {
            setMode('list');
            setEditing(null);
            reload();
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
          { label: 'Đối tác', href: '/customers' },
          { label: tabLabel },
        ]}
      />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-serif text-2xl font-semibold">Đối tác</h2>
          <p className="text-sm text-slate-500">
            {partnerTabDescription[partnerType]}. Một đối tác có thể thuộc
            nhiều nhóm.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ColumnVisibilityMenu
            columns={columns}
            isVisible={isVisible}
            toggle={toggle}
            showAll={showAll}
            reset={reset}
          />
          <CsvDataTransfer
            title={tabLabel.toLowerCase()}
            filenamePrefix={`doi-tac-${partnerType.toLowerCase()}`}
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
                partnerTypes: partnerType,
              },
            ]}
            onExport={exportAllCustomers}
            validateRow={(row) => {
              const errors: string[] = [];
              if (
                row.partnerTypes?.trim() &&
                parsePartnerTypesCell(row.partnerTypes) == null
              ) {
                errors.push('Loại đối tác: INVESTOR | SUBCONTRACTOR | SUPPLIER');
              }
              if (!row.code?.trim()) errors.push('Thiếu mã KH (*)');
              if (!row.name?.trim()) errors.push('Thiếu tên KH (*)');
              if (row.code && row.code.trim().length > 50) {
                errors.push('Mã KH tối đa 50 ký tự');
              }
              if (row.name && row.name.trim().length > 255) {
                errors.push('Tên KH tối đa 255 ký tự');
              }
              if (
                row.status?.trim() &&
                normalizeCustomerStatus(row.status) == null
              ) {
                errors.push('Trạng thái: ACTIVE | INACTIVE');
              }
              if (row.contactEmail?.trim()) {
                const email = row.contactEmail.trim();
                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                  errors.push('Email không hợp lệ');
                }
              }
              return errors;
            }}
            onImport={handleImportCsv}
          />
          <WriteOnly>
            <Button onClick={() => setMode('create')}>
              <Plus className="h-4 w-4" />
              Thêm {tabLabel.toLowerCase()}
            </Button>
          </WriteOnly>
        </div>
      </div>

      <PartnerTypeTabs active={partnerType} />

      <CollapsibleFilters title="Tìm kiếm">
        <div className="relative max-w-xl">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            className="pl-9"
            placeholder="Tìm mã, tên, MST, người liên hệ..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </CollapsibleFilters>

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <QueryState
            loading={loading}
            error={error}
            empty={data.length === 0}
            emptyMessage={`Chưa có ${tabLabel.toLowerCase()} nào.`}
            emptyAction={
              <Button variant="outline" onClick={() => setMode('create')}>
                Thêm {tabLabel.toLowerCase()} đầu tiên
              </Button>
            }
            onRetry={reload}
          >
            <TableBulkActionBar
              selectedCount={selectedCount}
              entityLabel={tabLabel.toLowerCase()}
              onClear={clearSelection}
              onConfirmDelete={handleBulkDelete}
              deleting={bulkDeleting}
            />
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHeadCheckbox
                      checked={allSelected}
                      indeterminate={someSelected}
                      onChange={toggleAll}
                      disabled={data.length === 0}
                    />
                    {isVisible('code') && <TableHead>Mã</TableHead>}
                    {isVisible('name') && <TableHead>Tên {tabLabel.toLowerCase()}</TableHead>}
                    {isVisible('taxCode') && <TableHead>Mã số thuế</TableHead>}
                    {isVisible('contactName') && (
                      <TableHead>Người liên hệ</TableHead>
                    )}
                    {isVisible('contactPhone') && (
                      <TableHead>Số điện thoại</TableHead>
                    )}
                    {isVisible('contactEmail') && <TableHead>Email</TableHead>}
                    {isVisible('partnerTypes') && (
                      <TableHead>Loại đối tác</TableHead>
                    )}
                    {isVisible('status') && <TableHead>Trạng thái</TableHead>}
                    {isVisible('actions') && (
                      <TableHead className="text-right">Thao tác</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((customer) => (
                    <TableRow key={customer.id}>
                      <TableCellCheckbox
                        checked={selectedIds.has(customer.id)}
                        onChange={(checked) =>
                          toggleOne(customer.id, checked)
                        }
                      />
                      {isVisible('code') && (
                        <TableCell className="font-medium">
                          {customer.code}
                        </TableCell>
                      )}
                      {isVisible('name') && (
                        <TableCell>{customer.name}</TableCell>
                      )}
                      {isVisible('taxCode') && (
                        <TableCell>{customer.taxCode || '—'}</TableCell>
                      )}
                      {isVisible('contactName') && (
                        <TableCell>{customer.contactName || '—'}</TableCell>
                      )}
                      {isVisible('contactPhone') && (
                        <TableCell>{customer.contactPhone || '—'}</TableCell>
                      )}
                      {isVisible('contactEmail') && (
                        <TableCell>{customer.contactEmail || '—'}</TableCell>
                      )}
                      {isVisible('partnerTypes') && (
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {(customer.partnerTypes ?? []).map((t) => (
                              <Badge
                                key={t}
                                variant={t === partnerType ? 'default' : 'muted'}
                              >
                                {partnerTypeLabel[t]}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                      )}
                      {isVisible('status') && (
                        <TableCell>
                          <CustomerStatusBadge status={customer.status} />
                        </TableCell>
                      )}
                      {isVisible('actions') && (
                        <TableCell>
                          <div className="flex justify-end gap-2">
                            <WriteOnly>
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
                            </WriteOnly>
                            <ConfirmDeleteButton
                              onConfirm={() => handleDelete(customer)}
                              title={`Xóa ${tabLabel.toLowerCase()}?`}
                              description={
                                (customer.partnerTypes ?? []).length > 1
                                  ? `Gỡ ${customer.code} khỏi nhóm ${tabLabel}. Đối tác vẫn giữ ở các nhóm khác.`
                                  : `Xóa mềm đối tác ${customer.code}.`
                              }
                            />
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <InfiniteScrollFooter
              hasMore={hasMore}
              loadingMore={loadingMore}
              total={total}
              onLoadMore={loadMore}
            />
          </QueryState>
        </CardContent>
      </Card>
    </div>
  );
}
