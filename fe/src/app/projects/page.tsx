'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Plus, Search } from 'lucide-react';
import { toast } from 'sonner';
import { customersApi, projectsApi } from '@/lib/api';
import { formatDate } from '@/lib/format';
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
import { PaginationBar } from '@/components/shared/pagination-bar';
import { QueryState } from '@/components/shared/query-state';
import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { CollapsibleFilters } from '@/components/shared/collapsible-filters';

const PAGE_SIZE = 10;

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

export default function ProjectsPage() {
  const [data, setData] = useState<Project[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<ProjectStatus | ''>('');
  const [customerId, setCustomerId] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

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
        aliases: ['customerCode', 'Mã KH'],
        type: 'select' as const,
        options: customers.map((c) => ({
          value: c.code,
          label: `${c.code} — ${c.name}`,
        })),
        sample: 'BV175',
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

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await projectsApi.list({
        search,
        status: status || undefined,
        customerId: customerId || undefined,
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
        err instanceof Error ? err.message : 'Không tải được dự án';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [search, status, customerId, page]);

  useEffect(() => {
    customersApi
      .list({ limit: 100, sortBy: 'code', sortOrder: 'asc' })
      .then((res) => setCustomers(res.data))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 250);
    return () => clearTimeout(timer);
  }, [load]);

  const handleImportCsv = async (rows: Array<Record<string, string>>) => {
    await projectsApi.bulkUpsert(
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
      })),
    );
    await load();
  };

  const handleDelete = async (id: string) => {
    try {
      await projectsApi.remove(id);
      toast.success('Đã xóa dự án');
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Xóa thất bại');
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
            Danh sách dự án, tìm kiếm và lọc theo trạng thái / khách hàng
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CsvDataTransfer
            title="dự án"
            filenamePrefix="du-an"
            columns={projectCsvColumns}
            sampleRows={[
              {
                code: '175-MAU',
                name: 'Du an mau',
                customerCode: customers[0]?.code ?? 'BV175',
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
            exportRows={data.map((item) => ({
              code: item.code,
              name: item.name,
              customerCode: item.customer?.code ?? '',
              projectType: item.projectType ?? '',
              location: item.location ?? '',
              address: item.address ?? '',
              status: item.status,
              startDate: item.startDate?.slice(0, 10) ?? '',
              endDate: item.endDate?.slice(0, 10) ?? '',
              description: item.description ?? '',
              note: item.note ?? '',
            }))}
            validateRow={(row) => {
              const errors: string[] = [];
              if (!row.code?.trim()) errors.push('Thiếu mã dự án');
              if (!row.name?.trim()) errors.push('Thiếu tên dự án');
              if (
                row.customerCode?.trim() &&
                !customers.some(
                  (c) =>
                    c.code.toLowerCase() ===
                    row.customerCode.trim().toLowerCase(),
                )
              ) {
                errors.push(`Mã KH "${row.customerCode}" không tồn tại`);
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
          <Button asChild>
            <Link href="/projects/new">
              <Plus className="h-4 w-4" />
              Thêm dự án
            </Link>
          </Button>
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
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <Select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as ProjectStatus | '');
              setPage(1);
            }}
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
            onChange={(e) => {
              setCustomerId(e.target.value);
              setPage(1);
            }}
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
              <Button asChild variant="outline">
                <Link href="/projects/new">Tạo dự án đầu tiên</Link>
              </Button>
            }
            onRetry={load}
          >
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mã dự án</TableHead>
                    <TableHead>Tên dự án</TableHead>
                    <TableHead>Khách hàng</TableHead>
                    <TableHead>Loại dự án</TableHead>
                    <TableHead>Ngày bắt đầu</TableHead>
                    <TableHead>Ngày kết thúc</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead className="text-right">Thao tác</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((project) => (
                    <TableRow key={project.id}>
                      <TableCell className="font-medium">
                        {project.code}
                      </TableCell>
                      <TableCell>{project.name}</TableCell>
                      <TableCell>
                        {project.customer
                          ? `${project.customer.code} — ${project.customer.name}`
                          : '—'}
                      </TableCell>
                      <TableCell>{project.projectType || '—'}</TableCell>
                      <TableCell>{formatDate(project.startDate)}</TableCell>
                      <TableCell>{formatDate(project.endDate)}</TableCell>
                      <TableCell>
                        <ProjectStatusBadge status={project.status} />
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          <Button asChild size="sm" variant="outline">
                            <Link href={`/projects/${project.id}`}>Xem</Link>
                          </Button>
                          <Button asChild size="sm" variant="secondary">
                            <Link href={`/projects/${project.id}/edit`}>
                              Sửa
                            </Link>
                          </Button>
                          <ConfirmDeleteButton
                            onConfirm={() => handleDelete(project.id)}
                            title="Xóa dự án?"
                            description={`Xóa mềm dự án ${project.code}.`}
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
