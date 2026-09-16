'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Plus, Search } from 'lucide-react';
import { toast } from 'sonner';
import {
  ApiError,
  contractsApi,
  projectsApi,
  type ContractBulkPayload,
} from '@/lib/api';
import { formatCurrencyVND, formatDate } from '@/lib/format';
import {
  isValidAmount,
  isValidOptionalDate,
  normalizeAmount,
} from '@/lib/csv';
import type {
  BillingCycle,
  Contract,
  ContractStatus,
  ContractType,
  Project,
} from '@/lib/types';
import {
  BILLING_CYCLES,
  CONTRACT_STATUSES,
  CONTRACT_TYPES,
} from '@/lib/types';
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
  ContractStatusBadge,
  billingCycleLabel,
  contractStatusLabel,
  contractTypeLabel,
} from '@/components/shared/status-badges';
import { ConfirmDeleteButton } from '@/components/shared/confirm-delete-button';
import { CsvDataTransfer } from '@/components/shared/csv-data-transfer';
import { PaginationBar } from '@/components/shared/pagination-bar';
import { QueryState } from '@/components/shared/query-state';
import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { CollapsibleFilters } from '@/components/shared/collapsible-filters';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const PAGE_SIZE = 10;

type PendingDeletedContractImport = {
  items: ContractBulkPayload[];
  contractNos: string[];
};

function buildContractCsvColumns(projects: Project[]) {
  return [
    {
      key: 'projectCode',
      header: 'MaDuAn',
      aliases: ['projectCode', 'Mã dự án', 'project'],
      required: true,
      sample: '175',
      type: 'select' as const,
      options: projects.map((p) => ({
        value: p.code,
        label: `${p.code} — ${p.name}`,
      })),
    },
    {
      key: 'contractNo',
      header: 'SoHD',
      aliases: ['contractNo', 'Số HĐ', 'so hd'],
      required: true,
      sample: '175/2026/HDDV',
    },
    {
      key: 'name',
      header: 'TenHD',
      aliases: ['name', 'Tên HĐ', 'ten'],
      required: true,
      sample: 'Hop dong dich vu BV Quan Y 175',
    },
    {
      key: 'contractType',
      header: 'LoaiHD',
      aliases: ['contractType', 'Loại HĐ'],
      required: true,
      sample: 'MAINTENANCE',
      type: 'select' as const,
      options: CONTRACT_TYPES.map((t) => ({
        value: t,
        label: contractTypeLabel[t],
      })),
    },
    {
      key: 'contractValue',
      header: 'GiaTri',
      aliases: ['contractValue', 'Giá trị', 'value'],
      required: true,
      sample: '7500000000',
      type: 'money' as const,
    },
    {
      key: 'billingCycle',
      header: 'ChuKy',
      aliases: ['billingCycle', 'Chu kỳ'],
      required: true,
      sample: 'MONTHLY',
      type: 'select' as const,
      options: BILLING_CYCLES.map((c) => ({
        value: c,
        label: billingCycleLabel[c],
      })),
    },
    {
      key: 'status',
      header: 'TrangThai',
      aliases: ['status', 'Trạng thái'],
      sample: 'ACTIVE',
      type: 'select' as const,
      options: CONTRACT_STATUSES.map((s) => ({
        value: s,
        label: contractStatusLabel[s],
      })),
    },
    {
      key: 'paymentTermDays',
      header: 'HanTT',
      aliases: ['paymentTermDays', 'Hạn TT'],
      sample: '60',
    },
    {
      key: 'startDate',
      header: 'NgayBD',
      aliases: ['startDate', 'Ngày BĐ'],
      sample: '2026-01-01',
      type: 'date' as const,
    },
    {
      key: 'endDate',
      header: 'NgayKT',
      aliases: ['endDate', 'Ngày KT'],
      sample: '2026-12-31',
      type: 'date' as const,
    },
    {
      key: 'signedDate',
      header: 'NgayKy',
      aliases: ['signedDate', 'Ngày ký'],
      sample: '2025-12-20',
      type: 'date' as const,
    },
    {
      key: 'note',
      header: 'GhiChu',
      aliases: ['note', 'Ghi chú'],
      sample: 'Hop dong mau',
    },
  ];
}

function toIsoDate(value?: string) {
  const v = value?.trim();
  if (!v) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    return new Date(`${v}T00:00:00.000Z`).toISOString();
  }
  return new Date(v).toISOString();
}

function normalizeEnum<T extends string>(
  value: string,
  allowed: readonly T[],
): T | null {
  const raw = value.trim().toUpperCase();
  if (!raw) return null;
  return (allowed as readonly string[]).includes(raw) ? (raw as T) : null;
}

export default function ContractsPage() {
  const [data, setData] = useState<Contract[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [projectId, setProjectId] = useState('');
  const [status, setStatus] = useState<ContractStatus | ''>('');
  const [contractType, setContractType] = useState<ContractType | ''>('');
  const [billingCycle, setBillingCycle] = useState<BillingCycle | ''>('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [pendingDeletedContractImport, setPendingDeletedContractImport] =
    useState<PendingDeletedContractImport | null>(null);

  const contractCsvColumns = useMemo(
    () => buildContractCsvColumns(projects),
    [projects],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await contractsApi.list({
        search,
        projectId: projectId || undefined,
        status: status || undefined,
        contractType: contractType || undefined,
        billingCycle: billingCycle || undefined,
        page,
        limit: PAGE_SIZE,
        sortBy: 'contractNo',
        sortOrder: 'asc',
      });
      setData(res.data);
      setTotal(res.meta.total);
      setTotalPages(res.meta.totalPages);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Không tải được hợp đồng';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [search, projectId, status, contractType, billingCycle, page]);

  useEffect(() => {
    projectsApi
      .list({ limit: 100, sortBy: 'code', sortOrder: 'asc' })
      .then((res) => setProjects(res.data))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 250);
    return () => clearTimeout(timer);
  }, [load]);

  const handleDelete = async (id: string) => {
    try {
      await contractsApi.remove(id);
      toast.success('Đã xóa hợp đồng');
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Xóa thất bại');
    }
  };

  const handleImportCsv = async (rows: Array<Record<string, string>>) => {
    const projectCodes = new Set(projects.map((p) => p.code.toLowerCase()));
    for (const row of rows) {
      if (!projectCodes.has(row.projectCode.trim().toLowerCase())) {
        throw new Error(`Không tìm thấy dự án mã "${row.projectCode}"`);
      }
    }

    const items: ContractBulkPayload[] = rows.map((row) => {
        const contractType = normalizeEnum(row.contractType, CONTRACT_TYPES)!;
        const billingCycle = normalizeEnum(row.billingCycle, BILLING_CYCLES)!;
        const status =
          normalizeEnum(row.status || 'ACTIVE', CONTRACT_STATUSES) ?? 'ACTIVE';
        const paymentTermDays = row.paymentTermDays?.trim()
          ? Number(row.paymentTermDays)
          : undefined;

        return {
          projectCode: row.projectCode.trim(),
          contractNo: row.contractNo.trim(),
          name: row.name.trim(),
          contractType,
          contractValue: Number(normalizeAmount(row.contractValue)),
          billingCycle,
          status,
          paymentTermDays,
          startDate: toIsoDate(row.startDate),
          endDate: toIsoDate(row.endDate),
          signedDate: toIsoDate(row.signedDate),
          note: row.note?.trim() || undefined,
        };
      });

    try {
      await contractsApi.bulkUpsert(items);
      await load();
    } catch (err) {
      const details = err instanceof ApiError ? err.details : undefined;
      const conflict = details as
        | { code?: string; contractNos?: string[] }
        | undefined;
      if (
        err instanceof ApiError &&
        err.status === 409 &&
        conflict?.code === 'DELETED_CONTRACT_CONFLICT'
      ) {
        setPendingDeletedContractImport({
          items,
          contractNos: conflict.contractNos ?? [],
        });
        return false;
      }
      throw err;
    }
  };

  const resolveDeletedContractImport = async (
    action: 'RESTORE' | 'REPLACE',
  ) => {
    if (!pendingDeletedContractImport) return;
    try {
      const result = await contractsApi.bulkUpsert(
        pendingDeletedContractImport.items,
        action,
      );
      toast.success(
        action === 'RESTORE'
          ? `Đã khôi phục/cập nhật ${result.updated} hợp đồng cũ.`
          : `Đã tạo mới ${result.created} hợp đồng và xóa hẳn bản cũ.`,
      );
      setPendingDeletedContractImport(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Nhập file thất bại');
    }
  };

  return (
    <div className="space-y-4">
      <AlertDialog
        open={pendingDeletedContractImport !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDeletedContractImport(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Phát hiện hợp đồng đã xóa</AlertDialogTitle>
            <AlertDialogDescription>
              Số hợp đồng {pendingDeletedContractImport?.contractNos.join(', ')}
              {' '}đã tồn tại dưới dạng bản xóa mềm. Bạn muốn xử lý thế nào?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={() => void resolveDeletedContractImport('REPLACE')}
            >
              Tạo mới, xóa hẳn bản cũ
            </Button>
            <Button onClick={() => void resolveDeletedContractImport('RESTORE')}>
              Khôi phục và cập nhật
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Breadcrumbs
        items={[
          { label: 'Quản lý dự án' },
          { label: 'Hợp đồng', href: '/contracts' },
        ]}
      />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-serif text-2xl font-semibold">Hợp đồng</h2>
          <p className="text-sm text-slate-500">
            Quản lý hợp đồng theo dự án, loại và chu kỳ nghiệm thu
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CsvDataTransfer
            title="hợp đồng"
            filenamePrefix="hop-dong"
            columns={contractCsvColumns}
            sampleRows={[
              {
                projectCode: '175',
                contractNo: '175/2026/HDDV-MAU',
                name: 'Hop dong dich vu mau',
                contractType: 'MAINTENANCE',
                contractValue: '7500000000',
                billingCycle: 'MONTHLY',
                status: 'ACTIVE',
                paymentTermDays: '60',
                startDate: '2026-01-01',
                endDate: '2026-12-31',
                signedDate: '2025-12-20',
                note: 'File mau import',
              },
            ]}
            exportRows={data.map((item) => ({
              projectCode: item.project?.code ?? '',
              contractNo: item.contractNo,
              name: item.name,
              contractType: item.contractType,
              contractValue: String(item.contractValue),
              billingCycle: item.billingCycle,
              status: item.status,
              paymentTermDays: String(item.paymentTermDays ?? 60),
              startDate: item.startDate?.slice(0, 10) ?? '',
              endDate: item.endDate?.slice(0, 10) ?? '',
              signedDate: item.signedDate?.slice(0, 10) ?? '',
              note: item.note ?? '',
            }))}
            validateRow={(row) => {
              const errors: string[] = [];
              if (!row.projectCode?.trim()) errors.push('Thiếu mã dự án');
              else if (
                !projects.some(
                  (p) =>
                    p.code.toLowerCase() === row.projectCode.trim().toLowerCase(),
                )
              ) {
                errors.push(`Mã dự án "${row.projectCode}" không tồn tại`);
              }
              if (!row.contractNo?.trim()) errors.push('Thiếu số HĐ');
              if (!row.name?.trim()) errors.push('Thiếu tên HĐ');
              if (!normalizeEnum(row.contractType ?? '', CONTRACT_TYPES)) {
                errors.push(`Loại HĐ: ${CONTRACT_TYPES.join(' | ')}`);
              }
              if (!isValidAmount(row.contractValue ?? '')) {
                errors.push('Giá trị không hợp lệ');
              }
              if (!normalizeEnum(row.billingCycle ?? '', BILLING_CYCLES)) {
                errors.push(`Chu kỳ: ${BILLING_CYCLES.join(' | ')}`);
              }
              if (
                row.status?.trim() &&
                !normalizeEnum(row.status, CONTRACT_STATUSES)
              ) {
                errors.push(`Trạng thái: ${CONTRACT_STATUSES.join(' | ')}`);
              }
              if (
                row.paymentTermDays?.trim() &&
                !/^\d+$/.test(row.paymentTermDays.trim())
              ) {
                errors.push('Hạn TT phải là số ngày');
              }
              if (!isValidOptionalDate(row.startDate ?? '')) {
                errors.push('Ngày BĐ YYYY-MM-DD');
              }
              if (!isValidOptionalDate(row.endDate ?? '')) {
                errors.push('Ngày KT YYYY-MM-DD');
              }
              if (!isValidOptionalDate(row.signedDate ?? '')) {
                errors.push('Ngày ký YYYY-MM-DD');
              }
              return errors;
            }}
            onImport={handleImportCsv}
          />
          <Button asChild>
            <Link href="/contracts/new">
              <Plus className="h-4 w-4" />
              Thêm hợp đồng
            </Link>
          </Button>
        </div>
      </div>

      <CollapsibleFilters>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <div className="relative md:col-span-2 xl:col-span-2">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              className="pl-9"
              placeholder="Tìm số HĐ, tên hợp đồng..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <Select
            value={projectId}
            onChange={(e) => {
              setProjectId(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Tất cả dự án</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} — {p.name}
              </option>
            ))}
          </Select>
          <Select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as ContractStatus | '');
              setPage(1);
            }}
          >
            <option value="">Tất cả trạng thái</option>
            {CONTRACT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {contractStatusLabel[s]}
              </option>
            ))}
          </Select>
          <Select
            value={contractType}
            onChange={(e) => {
              setContractType(e.target.value as ContractType | '');
              setPage(1);
            }}
          >
            <option value="">Tất cả loại HĐ</option>
            {CONTRACT_TYPES.map((t) => (
              <option key={t} value={t}>
                {contractTypeLabel[t]}
              </option>
            ))}
          </Select>
          <Select
            value={billingCycle}
            onChange={(e) => {
              setBillingCycle(e.target.value as BillingCycle | '');
              setPage(1);
            }}
            className="md:col-span-2 xl:col-span-1"
          >
            <option value="">Tất cả chu kỳ</option>
            {BILLING_CYCLES.map((c) => (
              <option key={c} value={c}>
                {billingCycleLabel[c]}
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
            emptyMessage="Chưa có hợp đồng nào."
            emptyAction={
              <Button asChild variant="outline">
                <Link href="/contracts/new">Tạo hợp đồng đầu tiên</Link>
              </Button>
            }
            onRetry={load}
          >
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Số hợp đồng</TableHead>
                    <TableHead>Tên hợp đồng</TableHead>
                    <TableHead>Dự án</TableHead>
                    <TableHead>Giá trị hợp đồng</TableHead>
                    <TableHead>Loại hợp đồng</TableHead>
                    <TableHead>Ngày ký</TableHead>
                    <TableHead>Ngày bắt đầu</TableHead>
                    <TableHead>Ngày kết thúc</TableHead>
                    <TableHead>Chu kỳ nghiệm thu</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead className="text-right">Thao tác</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((contract) => (
                    <TableRow key={contract.id}>
                      <TableCell className="font-medium">
                        <Link
                          href={`/contracts/${contract.id}`}
                          className="underline-offset-2 hover:text-slate-950 hover:underline"
                        >
                          {contract.contractNo}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/contracts/${contract.id}`}
                          className="underline-offset-2 hover:text-slate-950 hover:underline"
                        >
                          {contract.name}
                        </Link>
                      </TableCell>
                      <TableCell>
                        {contract.project?.code ?? '—'}
                      </TableCell>
                      <TableCell>
                        {formatCurrencyVND(contract.contractValue)}
                      </TableCell>
                      <TableCell>
                        {contractTypeLabel[contract.contractType]}
                      </TableCell>
                      <TableCell className="text-xs tabular-nums text-slate-600">
                        {formatDate(contract.signedDate)}
                      </TableCell>
                      <TableCell className="text-xs tabular-nums text-slate-600">
                        {formatDate(contract.startDate)}
                      </TableCell>
                      <TableCell className="text-xs tabular-nums text-slate-600">
                        {formatDate(contract.endDate)}
                      </TableCell>
                      <TableCell>
                        {billingCycleLabel[contract.billingCycle]}
                      </TableCell>
                      <TableCell>
                        <ContractStatusBadge status={contract.status} />
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          <Button asChild size="sm" variant="outline">
                            <Link href={`/contracts/${contract.id}`}>Xem</Link>
                          </Button>
                          <Button asChild size="sm" variant="secondary">
                            <Link href={`/contracts/${contract.id}/edit`}>
                              Sửa
                            </Link>
                          </Button>
                          <ConfirmDeleteButton
                            onConfirm={() => handleDelete(contract.id)}
                            title="Xóa hợp đồng?"
                            description={`Xóa mềm hợp đồng ${contract.contractNo}.`}
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
