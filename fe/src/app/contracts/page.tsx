'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAuth, WriteOnly } from '@/components/auth/auth-provider';
import { hasFeature, isLimitedUser } from '@/lib/features';
import { Plus, Search } from 'lucide-react';
import { toast } from 'sonner';
import {
  ApiError,
  companiesApi,
  contractsApi,
  customersApi,
  projectsApi,
  type ContractBulkPayload,
} from '@/lib/api';
import {
  ContractExpiryBadge,
  ContractExpiryHighlight,
  contractExpiryRowClass,
} from '@/components/contracts/contract-expiry-highlight';
import { ContractFormDialog } from '@/components/contracts/contract-form-dialog';
import {
  contractKindLabel,
  contractListHref,
  isExpenseContractKind,
  parseContractKind,
  partnerTypeLabel,
} from '@/lib/contract-kind';
import { formatCurrencyVND, formatDate } from '@/lib/format';
import {
  isValidAmount,
  isValidOptionalDate,
  normalizeAmount,
} from '@/lib/csv';
import type {
  BillingCycle,
  Company,
  Contract,
  ContractKind,
  ContractStatus,
  ContractType,
  Customer,
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
import { InfiniteScrollFooter } from '@/components/shared/infinite-scroll-footer';
import { QueryState } from '@/components/shared/query-state';
import {
  TableBulkActionBar,
  TableCellCheckbox,
  TableHeadCheckbox,
} from '@/components/shared/table-selection';
import { ColumnVisibilityMenu } from '@/components/shared/column-visibility-menu';
import { useInfinitePaginatedList } from '@/hooks/use-infinite-paginated-list';
import { useTableSelection } from '@/hooks/use-table-selection';
import {
  useColumnVisibility,
  type ColumnDef,
} from '@/hooks/use-column-visibility';
import {
  formatContractTypesDisplay,
  normalizeContractTypesInput,
  validateContractTypesField,
} from '@/lib/contract-type';
import { fetchAllPaginated } from '@/lib/fetch-all-paginated';
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

type ContractCol =
  | 'contractNo'
  | 'name'
  | 'project'
  | 'company'
  | 'counterparty'
  | 'contractValue'
  | 'contractType'
  | 'signedDate'
  | 'startDate'
  | 'endDate'
  | 'durationYears'
  | 'expiry'
  | 'billingCycle'
  | 'status'
  | 'actions';

const CONTRACT_COLUMNS: ColumnDef<ContractCol>[] = [
  { key: 'contractNo', label: 'Số hợp đồng', locked: true },
  { key: 'name', label: 'Tên hợp đồng', locked: true },
  { key: 'project', label: 'Dự án' },
  { key: 'company', label: 'Công ty' },
  { key: 'counterparty', label: 'Đối tác' },
  { key: 'contractValue', label: 'Giá trị hợp đồng' },
  { key: 'contractType', label: 'Loại hợp đồng' },
  { key: 'signedDate', label: 'Ngày ký' },
  { key: 'startDate', label: 'Ngày bắt đầu' },
  { key: 'endDate', label: 'Ngày kết thúc' },
  { key: 'durationYears', label: 'Thời hạn (năm)' },
  { key: 'expiry', label: 'Thời hạn (theo ngày KT)' },
  { key: 'billingCycle', label: 'Chu kỳ nghiệm thu' },
  { key: 'status', label: 'Trạng thái HĐ' },
  { key: 'actions', label: 'Thao tác', locked: true },
];

type PendingDeletedContractImport = {
  items: ContractBulkPayload[];
  contractNos: string[];
};

function buildContractCsvColumns(
  projects: Project[],
  kind: ContractKind,
  companies: Company[],
  partners: Customer[],
) {
  const expense = isExpenseContractKind(kind);
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
      key: 'companyCode',
      header: 'MaCongTy',
      aliases: ['companyCode', 'Mã công ty', 'cong ty'],
      required: expense,
      sample: companies[0]?.code ?? 'SICOM',
      type: 'select' as const,
      options: companies.map((c) => ({
        value: c.code,
        label: `${c.code} — ${c.name}`,
      })),
    },
    ...(expense
      ? [
          {
            key: 'counterpartyCode',
            header: 'MaDoiTac',
            aliases: [
              'counterpartyCode',
              'Mã đối tác',
              'Mã thầu phụ',
              'Mã NCC',
            ],
            required: true,
            sample: partners[0]?.code ?? 'TP001',
            type: 'select' as const,
            options: partners.map((p) => ({
              value: p.code,
              label: `${p.code} — ${p.name}`,
            })),
          },
        ]
      : []),
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
      sample: 'OPERATION;MAINTENANCE',
      type: 'multi-select' as const,
      multiSeparator: ';',
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
      key: 'durationYears',
      header: 'ThoiHanNam',
      aliases: [
        'durationYears',
        'Thoi han nam',
        'Thời hạn năm',
        'ThoiHan',
      ],
      sample: '1',
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

function contractToExportRow(item: Contract): Record<string, string> {
  return {
    projectCode: item.project?.code ?? '',
    companyCode: item.company?.code ?? '',
    counterpartyCode: item.counterparty?.code ?? '',
    contractNo: item.contractNo,
    name: item.name,
    contractType: item.contractType,
    contractValue: String(item.contractValue),
    billingCycle: item.billingCycle,
    durationYears:
      item.durationYears != null && item.durationYears > 0
        ? String(item.durationYears)
        : '',
    status: item.status,
    paymentTermDays: String(item.paymentTermDays ?? 60),
    startDate: item.startDate?.slice(0, 10) ?? '',
    endDate: item.endDate?.slice(0, 10) ?? '',
    signedDate: item.signedDate?.slice(0, 10) ?? '',
    note: item.note ?? '',
  };
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

/** Số / tên HĐ: link sang chi tiết, hoặc chữ thường khi tài khoản không được xem chi tiết */
function ContractCellLink({
  contractId,
  enabled,
  children,
}: {
  contractId: string;
  enabled: boolean;
  children: React.ReactNode;
}) {
  if (!enabled) return <span>{children}</span>;
  return (
    <Link
      href={`/contracts/${contractId}`}
      className="underline-offset-2 hover:text-slate-950 hover:underline"
    >
      {children}
    </Link>
  );
}

export default function ContractsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-slate-500">Đang tải...</div>}>
      <ContractsPageContent />
    </Suspense>
  );
}

function ContractsPageContent() {
  const searchParams = useSearchParams();
  const kind = parseContractKind(searchParams.get('kind'));
  // key: đổi tab → reset bộ lọc / lựa chọn
  return <ContractsTab key={kind} kind={kind} />;
}

function ContractsTab({ kind }: { kind: ContractKind }) {
  const expense = isExpenseContractKind(kind);
  const kindLabel = contractKindLabel[kind];
  const { user } = useAuth();
  // Tài khoản giới hạn: chỉ xem danh sách — không mở chi tiết / sửa / xóa / import
  const fullAccess = !isLimitedUser(user);
  const canCreate = hasFeature(user, 'contracts.create');
  const [projects, setProjects] = useState<Project[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [partners, setPartners] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [projectId, setProjectId] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [counterpartyId, setCounterpartyId] = useState('');
  const [status, setStatus] = useState<ContractStatus | ''>('');
  const [contractType, setContractType] = useState<ContractType | ''>('');
  const [billingCycle, setBillingCycle] = useState<BillingCycle | ''>('');
  const [bulkDeleting, setBulkDeleting] = useState(false);
  // Popup thêm / sửa HĐ: null = thêm mới
  const [formOpen, setFormOpen] = useState(false);
  const [formContract, setFormContract] = useState<Contract | null>(null);
  const openForm = (contract: Contract | null) => {
    setFormContract(contract);
    setFormOpen(true);
  };
  const [pendingDeletedContractImport, setPendingDeletedContractImport] =
    useState<PendingDeletedContractImport | null>(null);

  const contractCsvColumns = useMemo(
    () => buildContractCsvColumns(projects, kind, companies, partners),
    [projects, kind, companies, partners],
  );

  const listFilters = useMemo(
    () => ({
      kind,
      search,
      projectId: projectId || undefined,
      companyId: companyId || undefined,
      counterpartyId: counterpartyId || undefined,
      status: status || undefined,
      contractType: contractType || undefined,
      billingCycle: billingCycle || undefined,
      sortBy: 'contractNo',
      sortOrder: 'asc' as const,
    }),
    [
      kind,
      search,
      projectId,
      companyId,
      counterpartyId,
      status,
      contractType,
      billingCycle,
    ],
  );

  const fetchPage = useCallback(
    (page: number, limit: number) =>
      contractsApi.list({ ...listFilters, page, limit }),
    [listFilters],
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
  } = useInfinitePaginatedList<Contract>({
    fetchPage,
    resetDeps: [listFilters],
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

  // HĐ CĐT không có cột đối tác (khách hàng lấy theo dự án)
  const columns = useMemo(
    () =>
      expense
        ? CONTRACT_COLUMNS
        : CONTRACT_COLUMNS.filter((c) => c.key !== 'counterparty'),
    [expense],
  );
  const { isVisible: isColumnVisible, toggle, showAll, reset } =
    useColumnVisibility(
      kind === 'INVESTOR' ? 'table-cols:contracts' : `table-cols:contracts-${kind}`,
      columns,
    );
  const isVisible = (key: ContractCol) =>
    (expense || key !== 'counterparty') &&
    (fullAccess || key !== 'actions') &&
    isColumnVisible(key);

  useEffect(() => {
    projectsApi
      .list({ limit: 100, sortBy: 'code', sortOrder: 'asc' })
      .then((res) => setProjects(res.data))
      .catch(() => undefined);
    companiesApi
      .list({ limit: 100 })
      .then((res) => setCompanies(res.data))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!expense) return;
    fetchAllPaginated((page, limit) =>
      customersApi.list({
        page,
        limit,
        partnerType: kind,
        sortBy: 'code',
        sortOrder: 'asc',
      }),
    )
      .then(setPartners)
      .catch(() => undefined);
  }, [expense, kind]);

  // Khối hết hạn / hoàn thành: toàn bộ HĐ của tab (không theo bộ lọc);
  // tải lại khi tổng số HĐ đổi (xóa / import)
  const [highlightContracts, setHighlightContracts] = useState<Contract[]>([]);
  // Tăng sau khi sửa HĐ trong popup (đổi trạng thái / ngày KT không đổi total)
  const [highlightVersion, setHighlightVersion] = useState(0);
  useEffect(() => {
    fetchAllPaginated((page, limit) =>
      contractsApi.list({ kind, page, limit, sortBy: 'endDate', sortOrder: 'asc' }),
    )
      .then(setHighlightContracts)
      .catch(() => undefined);
  }, [kind, total, highlightVersion]);

  useEffect(() => {
    if (error) toast.error(error);
  }, [error]);

  const handleDelete = async (id: string) => {
    try {
      await contractsApi.remove(id);
      toast.success('Đã xóa hợp đồng');
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
      await Promise.all(ids.map((id) => contractsApi.remove(id)));
      toast.success(`Đã xóa ${ids.length} hợp đồng`);
      clearSelection();
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Xóa thất bại');
    } finally {
      setBulkDeleting(false);
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
        const contractType = normalizeContractTypesInput(row.contractType)!;
        const billingCycle = normalizeEnum(row.billingCycle, BILLING_CYCLES)!;
        const status =
          normalizeEnum(row.status || 'ACTIVE', CONTRACT_STATUSES) ?? 'ACTIVE';
        const paymentTermDays = row.paymentTermDays?.trim()
          ? Number(row.paymentTermDays)
          : undefined;
        const durationYears = row.durationYears?.trim()
          ? Number(row.durationYears)
          : undefined;
        return {
          projectCode: row.projectCode.trim(),
          companyCode: row.companyCode?.trim() || undefined,
          counterpartyCode: expense
            ? row.counterpartyCode?.trim() || undefined
            : undefined,
          contractNo: row.contractNo.trim(),
          name: row.name.trim(),
          contractType,
          contractValue: Number(normalizeAmount(row.contractValue)),
          billingCycle,
          status,
          paymentTermDays,
          durationYears:
            durationYears != null && durationYears > 0
              ? durationYears
              : undefined,
          startDate: toIsoDate(row.startDate),
          endDate: toIsoDate(row.endDate),
          signedDate: toIsoDate(row.signedDate),
          note: row.note?.trim() || undefined,
        };
      });

    try {
      await contractsApi.bulkUpsert(items, undefined, kind);
      await reload();
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

  const exportAllContracts = useCallback(async () => {
    const items = await fetchAllPaginated((page, limit) =>
      contractsApi.list({ ...listFilters, page, limit }),
    );
    return items.map(contractToExportRow);
  }, [listFilters]);

  const resolveDeletedContractImport = async (
    action: 'RESTORE' | 'REPLACE',
  ) => {
    if (!pendingDeletedContractImport) return;
    try {
      const result = await contractsApi.bulkUpsert(
        pendingDeletedContractImport.items,
        action,
        kind,
      );
      toast.success(
        action === 'RESTORE'
          ? `Đã khôi phục/cập nhật ${result.updated} hợp đồng cũ.`
          : `Đã tạo mới ${result.created} hợp đồng và xóa hẳn bản cũ.`,
      );
      setPendingDeletedContractImport(null);
      await reload();
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
          { label: kindLabel, href: contractListHref(kind) },
        ]}
      />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-serif text-2xl font-semibold">{kindLabel}</h2>
          <p className="text-sm text-slate-500">
            {expense
              ? `HĐ chi tiền cho ${partnerTypeLabel[kind].toLowerCase()} — theo công ty và dự án`
              : 'HĐ thu tiền với chủ đầu tư — theo dự án, loại và chu kỳ nghiệm thu'}
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
            hideImport={!fullAccess}
            title={kindLabel}
            filenamePrefix={
              kind === 'INVESTOR' ? 'hop-dong' : `hop-dong-${kind.toLowerCase()}`
            }
            columns={contractCsvColumns}
            sampleRows={[
              {
                projectCode: '175',
                companyCode: companies[0]?.code ?? 'SICOM',
                ...(expense
                  ? { counterpartyCode: partners[0]?.code ?? 'TP001' }
                  : {}),
                contractNo: '175/2026/HDDV-MAU',
                name: 'Hop dong dich vu mau',
                contractType: 'OPERATION;MAINTENANCE',
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
            onExport={exportAllContracts}
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
              const companyCode = row.companyCode?.trim().toLowerCase();
              if (!companyCode) {
                if (expense) errors.push('Thiếu mã công ty');
              } else if (
                !companies.some((c) => c.code.toLowerCase() === companyCode)
              ) {
                errors.push(`Mã công ty "${row.companyCode}" không tồn tại`);
              }
              if (expense) {
                const partnerCode = row.counterpartyCode?.trim().toLowerCase();
                if (!partnerCode) {
                  errors.push(`Thiếu mã ${partnerTypeLabel[kind].toLowerCase()}`);
                } else if (
                  !partners.some((p) => p.code.toLowerCase() === partnerCode)
                ) {
                  errors.push(
                    `Mã "${row.counterpartyCode}" không có trong ${partnerTypeLabel[kind]}`,
                  );
                }
              }
              if (!row.contractNo?.trim()) errors.push('Thiếu số HĐ');
              if (!row.name?.trim()) errors.push('Thiếu tên HĐ');
              errors.push(...validateContractTypesField(row.contractType ?? ''));
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
          {canCreate ? (
            <Button onClick={() => openForm(null)}>
              <Plus className="h-4 w-4" />
              Thêm {kindLabel}
            </Button>
          ) : null}
        </div>
      </div>

      <ContractExpiryHighlight
        contracts={highlightContracts}
        linkable={fullAccess}
      />

      <ContractFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        contract={formContract}
        defaultKind={kind}
        onSaved={() => {
          void reload();
          setHighlightVersion((v) => v + 1);
        }}
      />

      <CollapsibleFilters>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <div className="relative md:col-span-2 xl:col-span-2">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              className="pl-9"
              placeholder={
                expense
                  ? 'Tìm số HĐ, tên HĐ, tên đối tác...'
                  : 'Tìm số HĐ, tên hợp đồng...'
              }
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
          >
            <option value="">Tất cả dự án</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} — {p.name}
              </option>
            ))}
          </Select>
          <Select
            value={companyId}
            onChange={(e) => setCompanyId(e.target.value)}
          >
            <option value="">Tất cả công ty</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} — {c.name}
              </option>
            ))}
          </Select>
          {expense ? (
            <Select
              value={counterpartyId}
              onChange={(e) => setCounterpartyId(e.target.value)}
            >
              <option value="">
                Tất cả {partnerTypeLabel[kind].toLowerCase()}
              </option>
              {partners.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} — {p.name}
                </option>
              ))}
            </Select>
          ) : null}
          <Select
            value={status}
            onChange={(e) => setStatus(e.target.value as ContractStatus | '')}
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
            onChange={(e) =>
              setContractType(e.target.value as ContractType | '')
            }
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
            onChange={(e) =>
              setBillingCycle(e.target.value as BillingCycle | '')
            }
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
            emptyMessage={`Chưa có ${kindLabel} nào.`}
            emptyAction={
              canCreate ? (
                <Button variant="outline" onClick={() => openForm(null)}>
                  Tạo {kindLabel} đầu tiên
                </Button>
              ) : undefined
            }
            onRetry={reload}
          >
            {fullAccess ? (
              <TableBulkActionBar
                selectedCount={selectedCount}
                entityLabel="hợp đồng"
                onClear={clearSelection}
                onConfirmDelete={handleBulkDelete}
                deleting={bulkDeleting}
              />
            ) : null}
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {fullAccess ? (
                      <TableHeadCheckbox
                        checked={allSelected}
                        indeterminate={someSelected}
                        onChange={toggleAll}
                        disabled={data.length === 0}
                      />
                    ) : null}
                    {isVisible('contractNo') && (
                      <TableHead>Số hợp đồng</TableHead>
                    )}
                    {isVisible('name') && <TableHead>Tên hợp đồng</TableHead>}
                    {isVisible('project') && <TableHead>Dự án</TableHead>}
                    {isVisible('company') && <TableHead>Công ty</TableHead>}
                    {isVisible('counterparty') && (
                      <TableHead>{partnerTypeLabel[kind]}</TableHead>
                    )}
                    {isVisible('contractValue') && (
                      <TableHead>Giá trị hợp đồng</TableHead>
                    )}
                    {isVisible('contractType') && (
                      <TableHead>Loại hợp đồng</TableHead>
                    )}
                    {isVisible('signedDate') && <TableHead>Ngày ký</TableHead>}
                    {isVisible('startDate') && (
                      <TableHead>Ngày bắt đầu</TableHead>
                    )}
                    {isVisible('endDate') && (
                      <TableHead>Ngày kết thúc</TableHead>
                    )}
                    {isVisible('durationYears') && (
                      <TableHead>Thời hạn (năm)</TableHead>
                    )}
                    {isVisible('expiry') && <TableHead>Thời hạn</TableHead>}
                    {isVisible('billingCycle') && (
                      <TableHead>Chu kỳ nghiệm thu</TableHead>
                    )}
                    {isVisible('status') && (
                      <TableHead>Trạng thái HĐ</TableHead>
                    )}
                    {isVisible('actions') && (
                      <TableHead className="text-right">Thao tác</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((contract) => (
                    <TableRow
                      key={contract.id}
                      className={contractExpiryRowClass(
                        contract.endDate,
                        contract.status,
                      )}
                    >
                      {fullAccess ? (
                        <TableCellCheckbox
                          checked={selectedIds.has(contract.id)}
                          onChange={(checked) =>
                            toggleOne(contract.id, checked)
                          }
                        />
                      ) : null}
                      {isVisible('contractNo') && (
                        <TableCell className="font-medium">
                          <ContractCellLink contractId={contract.id} enabled={fullAccess}>
                            {contract.contractNo}
                          </ContractCellLink>
                        </TableCell>
                      )}
                      {isVisible('name') && (
                        <TableCell>
                          <ContractCellLink contractId={contract.id} enabled={fullAccess}>
                            {contract.name}
                          </ContractCellLink>
                        </TableCell>
                      )}
                      {isVisible('project') && (
                        <TableCell>
                          {contract.project?.code ?? '—'}
                        </TableCell>
                      )}
                      {isVisible('company') && (
                        <TableCell>{contract.company?.code ?? '—'}</TableCell>
                      )}
                      {isVisible('counterparty') && (
                        <TableCell>
                          {contract.counterparty
                            ? `${contract.counterparty.code} — ${contract.counterparty.name}`
                            : '—'}
                        </TableCell>
                      )}
                      {isVisible('contractValue') && (
                        <TableCell>
                          {formatCurrencyVND(contract.contractValue)}
                        </TableCell>
                      )}
                      {isVisible('contractType') && (
                        <TableCell>
                          {formatContractTypesDisplay(contract.contractType)}
                        </TableCell>
                      )}
                      {isVisible('signedDate') && (
                        <TableCell className="text-xs tabular-nums text-slate-600">
                          {formatDate(contract.signedDate)}
                        </TableCell>
                      )}
                      {isVisible('startDate') && (
                        <TableCell className="text-xs tabular-nums text-slate-600">
                          {formatDate(contract.startDate)}
                        </TableCell>
                      )}
                      {isVisible('endDate') && (
                        <TableCell className="text-xs tabular-nums text-slate-600">
                          {formatDate(contract.endDate)}
                        </TableCell>
                      )}
                      {isVisible('durationYears') && (
                        <TableCell className="tabular-nums text-slate-700">
                          {contract.durationYears != null &&
                          contract.durationYears > 0
                            ? contract.durationYears
                            : '—'}
                        </TableCell>
                      )}
                      {isVisible('expiry') && (
                        <TableCell>
                          <ContractExpiryBadge
                            endDate={contract.endDate}
                            status={contract.status}
                          />
                        </TableCell>
                      )}
                      {isVisible('billingCycle') && (
                        <TableCell>
                          {billingCycleLabel[contract.billingCycle]}
                        </TableCell>
                      )}
                      {isVisible('status') && (
                        <TableCell>
                          <ContractStatusBadge status={contract.status} />
                        </TableCell>
                      )}
                      {isVisible('actions') && (
                        <TableCell>
                          <div className="flex justify-end gap-2">
                            <Button asChild size="sm" variant="outline">
                              <Link href={`/contracts/${contract.id}`}>
                                Xem
                              </Link>
                            </Button>
                            <WriteOnly>
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => openForm(contract)}
                              >
                                Sửa
                              </Button>
                            </WriteOnly>
                            <ConfirmDeleteButton
                              onConfirm={() => handleDelete(contract.id)}
                              title="Xóa hợp đồng?"
                              description={`Xóa mềm hợp đồng ${contract.contractNo}.`}
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
