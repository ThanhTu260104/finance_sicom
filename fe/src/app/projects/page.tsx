'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Plus, Search } from 'lucide-react';
import { toast } from 'sonner';
import { customersApi, projectsApi } from '@/lib/api';
import { isValidOptionalDate } from '@/lib/csv';
import type { Customer, Project, ProjectStatus } from '@/lib/types';
import { PROJECT_STATUSES } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ProjectStatusBadge,
  projectStatusLabel,
} from '@/components/shared/status-badges';
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
import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { CollapsibleFilters } from '@/components/shared/collapsible-filters';
import {
  normalizeProjectManagerImportValue,
  projectManagerDisplay,
  projectManagerExportValue,
} from '@/lib/project-manager';
import { fetchAllPaginated } from '@/lib/fetch-all-paginated';
import { WriteOnly } from '@/components/auth/auth-provider';

type ProjectCol =
  | 'code'
  | 'name'
  | 'projectManager'
  | 'contractNos'
  | 'status'
  | 'actions';

const PROJECT_COLUMNS: ColumnDef<ProjectCol>[] = [
  { key: 'code', label: 'Mã dự án', locked: true },
  { key: 'name', label: 'Tên dự án', locked: true },
  { key: 'projectManager', label: 'Trưởng dự án' },
  { key: 'contractNos', label: 'Hợp đồng' },
  { key: 'status', label: 'Trạng thái' },
  { key: 'actions', label: 'Thao tác', locked: true },
];

function toIsoDate(value?: string) {
  const v = value?.trim();
  if (!v) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    return new Date(`${v}T00:00:00.000Z`).toISOString();
  }
  return new Date(v).toISOString();
}

function normalizeProjectStatus(value: string): ProjectStatus | null {
  const raw = value.trim().toUpperCase();
  if (!raw) return 'ACTIVE';
  return (PROJECT_STATUSES as readonly string[]).includes(raw)
    ? (raw as ProjectStatus)
    : null;
}

function projectToExportRow(item: Project): Record<string, string> {
  const contractNos =
    item.contracts?.map((c) => c.contractNo).join('; ') ?? '';
  return {
    code: item.code,
    name: item.name,
    customerCode: item.customer?.code ?? '',
    customerName: item.customer?.name ?? '',
    projectManagerName: projectManagerExportValue(item),
    contractNos,
    projectType: item.projectType ?? '',
    location: item.location ?? '',
    address: item.address ?? '',
    status: item.status,
    startDate: item.startDate?.slice(0, 10) ?? '',
    endDate: item.endDate?.slice(0, 10) ?? '',
    description: item.description ?? '',
    note: item.note ?? '',
  };
}

export default function ProjectsPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<ProjectStatus | ''>('');
  const [customerId, setCustomerId] = useState('');
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const projectCsvColumns = useMemo(
    () => [
      {
        key: 'code',
        header: 'MaDuAn',
        aliases: ['code', 'Mã dự án'],
        required: true,
        sample: '175',
      },
      {
        key: 'name',
        header: 'TenDuAn',
        aliases: ['name', 'Tên dự án'],
        required: true,
        sample: 'BV Quan Y 175',
      },
      {
        key: 'customerCode',
        header: 'MaKhachHang',
        aliases: ['customerCode', 'Mã khách hàng', 'Mã KH'],
        type: 'select' as const,
        options: customers.map((c) => ({
          value: c.code,
          label: `${c.code} — ${c.name}`,
        })),
        sample: 'BV175',
      },
      {
        key: 'customerName',
        header: 'TenKhachHang',
        aliases: ['customerName', 'Tên khách hàng'],
        sample: 'Benh vien mau',
      },
      {
        key: 'projectManagerName',
        header: 'TruongDuAn',
        aliases: [
          'projectManagerName',
          'Trưởng dự án',
          'Truong du an',
          'Truong Du An',
          'Nguoi phu trach',
          'Người phụ trách',
        ],
        sample: 'Nguyen Van A',
      },
      {
        key: 'contractNos',
        header: 'SoHopDong',
        aliases: ['contractNos', 'Số hợp đồng', 'Hợp đồng'],
        sample: '175/2026/HDDV-01; 175/2026/HDDV-02',
      },
      {
        key: 'projectType',
        header: 'LoaiDuAn',
        aliases: ['projectType', 'Loại dự án'],
        sample: 'Dich vu',
      },
      {
        key: 'location',
        header: 'DiaDiem',
        aliases: ['location', 'Địa điểm'],
        sample: 'TP.HCM',
      },
      {
        key: 'address',
        header: 'DiaChi',
        aliases: ['address', 'Địa chỉ'],
        sample: '',
      },
      {
        key: 'status',
        header: 'TrangThai',
        aliases: ['status', 'Trạng thái'],
        type: 'select' as const,
        options: PROJECT_STATUSES.map((s) => ({
          value: s,
          label: projectStatusLabel[s],
        })),
        sample: 'ACTIVE',
      },
      {
        key: 'startDate',
        header: 'NgayBD',
        aliases: ['startDate', 'Ngày BĐ'],
        type: 'date' as const,
        sample: '2026-01-01',
      },
      {
        key: 'endDate',
        header: 'NgayKT',
        aliases: ['endDate', 'Ngày KT'],
        type: 'date' as const,
        sample: '2026-12-31',
      },
      {
        key: 'description',
        header: 'MoTa',
        aliases: ['description', 'Mô tả'],
        sample: 'Du an mau',
      },
      {
        key: 'note',
        header: 'GhiChu',
        aliases: ['note', 'Ghi chú'],
        sample: '',
      },
    ],
    [customers],
  );

  const fetchPage = useCallback(
    (page: number, limit: number) =>
      projectsApi.list({
        search,
        status: status || undefined,
        customerId: customerId || undefined,
        page,
        limit,
        sortBy: 'code',
        sortOrder: 'asc',
      }),
    [search, status, customerId],
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
  } = useInfinitePaginatedList<Project>({
    fetchPage,
    resetDeps: [search, status, customerId],
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

  const columns = useMemo(() => PROJECT_COLUMNS, []);
  const { isVisible, toggle, showAll, reset } = useColumnVisibility(
    'table-cols:projects',
    columns,
  );

  useEffect(() => {
    fetchAllPaginated((page, limit) =>
      customersApi.list({ page, limit, sortBy: 'code', sortOrder: 'asc' }),
    )
      .then(setCustomers)
      .catch(() => undefined);
  }, []);

  const exportAllProjects = useCallback(async () => {
    const items = await fetchAllPaginated((page, limit) =>
      projectsApi.list({
        search,
        status: status || undefined,
        customerId: customerId || undefined,
        page,
        limit,
        sortBy: 'code',
        sortOrder: 'asc',
      }),
    );
    return items.map(projectToExportRow);
  }, [search, status, customerId]);

  useEffect(() => {
    if (error) toast.error(error);
  }, [error]);

  const handleImportCsv = async (rows: Array<Record<string, string>>) => {
    const result = await projectsApi.bulkUpsert(
      rows.map((row) => ({
        code: row.code.trim(),
        name: row.name.trim(),
        customerCode: row.customerCode?.trim() || undefined,
        projectType: row.projectType?.trim() || undefined,
        location: row.location?.trim() || undefined,
        address: row.address?.trim() || undefined,
        status: normalizeProjectStatus(row.status ?? '') ?? 'ACTIVE',
        startDate: toIsoDate(row.startDate),
        endDate: toIsoDate(row.endDate),
        description: row.description?.trim() || undefined,
        note: row.note?.trim() || undefined,
        projectManagerName: normalizeProjectManagerImportValue(
          row.projectManagerName,
        ),
      })),
    );
    toast.success(
      `Đã nhập ${result.count} dự án (${result.created} mới, ${result.updated} cập nhật)`,
    );
    await reload();
  };

  const handleDelete = async (id: string) => {
    try {
      await projectsApi.remove(id);
      toast.success('Đã xóa dự án');
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Xóa thất bại');
    }
  };

  const handleBulkDelete = async () => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    setBulkDeleting(true);
    try {
      await Promise.all(ids.map((id) => projectsApi.remove(id)));
      toast.success(`Đã xóa ${ids.length} dự án`);
      clearSelection();
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Xóa thất bại');
    } finally {
      setBulkDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <Breadcrumbs
        items={[
          { label: 'Quản lý dự án' },
          { label: 'Dự án', href: '/projects' },
        ]}
      />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-serif text-2xl font-semibold">Quản lý dự án</h2>
          <p className="text-sm text-slate-500">
            Danh sách dự án và số hợp đồng liên quan
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
            title="dự án"
            filenamePrefix="du-an"
            columns={projectCsvColumns}
            sampleRows={[
              {
                code: '175-MAU',
                name: 'Du an mau',
                customerCode: customers[0]?.code ?? 'BV175',
                customerName: customers[0]?.name ?? '',
                projectManagerName: '',
                contractNos: '',
                projectType: 'Dich vu',
                location: 'TP.HCM',
                address: '',
                status: 'ACTIVE',
                startDate: '2026-01-01',
                endDate: '2026-12-31',
                description: 'File mau import',
                note: '',
              },
            ]}
            onExport={exportAllProjects}
            validateRow={(row) => {
              const errors: string[] = [];
              if (!row.code?.trim()) errors.push('Thiếu mã dự án');
              if (!row.name?.trim()) errors.push('Thiếu tên dự án');
              const customerCode = row.customerCode?.trim();
              if (
                customerCode &&
                !customers.some(
                  (c) =>
                    c.code.localeCompare(customerCode, undefined, {
                      sensitivity: 'accent',
                    }) === 0 ||
                    c.code.toLowerCase() === customerCode.toLowerCase(),
                )
              ) {
                errors.push(`Mã KH "${customerCode}" không tồn tại`);
              }
              if (row.status?.trim() && !normalizeProjectStatus(row.status)) {
                errors.push(`Trạng thái: ${PROJECT_STATUSES.join(' | ')}`);
              }
              if (!isValidOptionalDate(row.startDate ?? '')) {
                errors.push('Ngày BĐ YYYY-MM-DD');
              }
              if (!isValidOptionalDate(row.endDate ?? '')) {
                errors.push('Ngày KT YYYY-MM-DD');
              }
              return errors;
            }}
            onImport={handleImportCsv}
          />
          <WriteOnly>
            <Button asChild>
              <Link href="/projects/new">
                <Plus className="h-4 w-4" />
                Thêm dự án
              </Link>
            </Button>
          </WriteOnly>
        </div>
      </div>

      <CollapsibleFilters>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              className="pl-9"
              placeholder="Tìm mã, tên dự án..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select
            value={status}
            onChange={(e) => setStatus(e.target.value as ProjectStatus | '')}
          >
            <option value="">Tất cả trạng thái</option>
            {PROJECT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {projectStatusLabel[s]}
              </option>
            ))}
          </Select>
          <Select
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
          >
            <option value="">Tất cả khách hàng</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} — {c.name}
              </option>
            ))}
          </Select>
        </div>
      </CollapsibleFilters>

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <QueryState
            loading={loading}
            error={error}
            empty={data.length === 0}
            emptyMessage="Chưa có dự án nào."
            emptyAction={
              <WriteOnly>
                <Button asChild variant="outline">
                  <Link href="/projects/new">Tạo dự án đầu tiên</Link>
                </Button>
              </WriteOnly>
            }
            onRetry={reload}
          >
            <TableBulkActionBar
              selectedCount={selectedCount}
              entityLabel="dự án"
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
                    {isVisible('code') && <TableHead>Mã dự án</TableHead>}
                    {isVisible('name') && <TableHead>Tên dự án</TableHead>}
                    {isVisible('projectManager') && (
                      <TableHead>Trưởng dự án</TableHead>
                    )}
                    {isVisible('contractNos') && (
                      <TableHead>Hợp đồng</TableHead>
                    )}
                    {isVisible('status') && <TableHead>Trạng thái</TableHead>}
                    {isVisible('actions') && (
                      <TableHead className="text-right">Thao tác</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((project) => {
                    const pmLabel = projectManagerDisplay(project);
                    return (
                    <TableRow key={project.id}>
                      <TableCellCheckbox
                        checked={selectedIds.has(project.id)}
                        onChange={(checked) => toggleOne(project.id, checked)}
                      />
                      {isVisible('code') && (
                        <TableCell className="font-medium">
                          {project.code}
                        </TableCell>
                      )}
                      {isVisible('name') && (
                        <TableCell>{project.name}</TableCell>
                      )}
                      {isVisible('projectManager') && (
                        <TableCell className="max-w-[12rem]">
                          <span
                            className="line-clamp-2 text-sm text-slate-800"
                            title={pmLabel}
                          >
                            {pmLabel}
                          </span>
                        </TableCell>
                      )}
                      {isVisible('contractNos') && (
                        <TableCell className="max-w-md">
                          {project.contracts?.length ? (
                            <div className="flex flex-col gap-2">
                              {project.contracts.map((c) => (
                                <Link
                                  key={c.id}
                                  href={`/contracts/${c.id}`}
                                  className="text-sm leading-snug text-slate-900 underline-offset-2 hover:underline"
                                >
                                  <span className="font-medium">{c.contractNo}</span>
                                  {c.name ? (
                                    <>
                                      <span className="text-slate-400"> — </span>
                                      <span className="text-slate-700">{c.name}</span>
                                    </>
                                  ) : null}
                                </Link>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </TableCell>
                      )}
                      {isVisible('status') && (
                        <TableCell>
                          <ProjectStatusBadge status={project.status} />
                        </TableCell>
                      )}
                      {isVisible('actions') && (
                        <TableCell>
                          <div className="flex justify-end gap-2">
                            <Button asChild size="sm" variant="outline">
                              <Link href={`/projects/${project.id}`}>Xem</Link>
                            </Button>
                            <WriteOnly>
                              <Button asChild size="sm" variant="secondary">
                                <Link href={`/projects/${project.id}/edit`}>
                                  Sửa
                                </Link>
                              </Button>
                            </WriteOnly>
                            <ConfirmDeleteButton
                              onConfirm={() => handleDelete(project.id)}
                              title="Xóa dự án?"
                              description={`Xóa mềm dự án ${project.code}.`}
                            />
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                    );
                  })}
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
