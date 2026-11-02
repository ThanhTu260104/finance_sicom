'use client';

import { Fragment, useMemo, useState } from 'react';
import { Paperclip } from 'lucide-react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { acceptancesApi } from '@/lib/api';
import {
  formatCurrencyVND,
  formatDate,
  formatPeriod,
  toDateInputValue,
} from '@/lib/format';
import {
  isValidAmount,
  isValidOptionalDate,
  isValidPeriod,
  normalizeAmount,
} from '@/lib/csv';
import { parseGroupedNumber } from '@/lib/number-format';
import {
  findPlanRowForAcceptance,
  groupAcceptancesByBatch,
  parseBatchSequenceFromAcceptanceNo,
  previewAcceptanceNoForPlan,
  resolveAcceptanceNoForSave,
  sumAcceptanceAmounts,
} from '@/lib/acceptance-plan-periods';
import { buildAcceptanceBatchOptions } from '@/lib/revenue-plan-batch-groups';
import { billingCycleUsesMonthlyPlanBreakdown } from '@/lib/billing-cycle-plan-ui';
import type {
  Acceptance,
  AcceptancePaymentStatus,
  BillingCycle,
  PeriodComparison,
} from '@/lib/types';
import { useContractFlowLabels } from '@/lib/contract-kind';
import {
  formatPlanBatchDateRange,
  PlanBatchDateRange,
} from '@/components/shared/plan-batch-date-range';
import { Select } from '@/components/ui/select';
import {
  ACCEPTANCE_PAYMENT_STATUSES,
  DOCUMENT_STATUSES,
} from '@/lib/types';
import {
  AcceptancePaymentStatusBadge,
  DocumentStatusBadge,
  acceptancePaymentStatusLabel,
  documentStatusLabel,
} from '@/components/shared/status-badges';
import { ConfirmDeleteButton } from '@/components/shared/confirm-delete-button';
import {
  buildPeriodOptions,
  CsvDataTransfer,
} from '@/components/shared/csv-data-transfer';
import { AccountingAcceptanceImport } from '@/components/quick-entry/accounting-acceptance-import';
import { CollapsibleSection } from '@/components/shared/collapsible-section';
import { KeyValueTable } from '@/components/shared/key-value-table';
import { AcceptanceAttachmentsPanel } from '@/components/contracts/acceptance-attachments-panel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MoneyInput } from '@/components/ui/money-input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  useAuth,
  WriteOnly,
} from '@/components/auth/auth-provider';

const PERIOD_OPTIONS = buildPeriodOptions();

const ACCEPTANCE_CSV_COLUMNS = [
  {
    key: 'acceptanceNo',
    header: 'SoDot',
    aliases: ['acceptanceNo', 'Số đợt', 'dot'],
    required: true,
    sample: 'Đợt 01/2026',
  },
  {
    key: 'period',
    header: 'Ky',
    aliases: ['period', 'Kỳ', 'ky'],
    required: true,
    sample: '2026-01',
    type: 'period' as const,
    options: PERIOD_OPTIONS,
  },
  {
    key: 'amount',
    header: 'SoTien',
    aliases: ['amount', 'Số tiền', 'gia tri'],
    required: true,
    sample: '500000000',
    type: 'money' as const,
  },
  {
    key: 'acceptanceDate',
    header: 'NgayNT',
    aliases: ['acceptanceDate', 'Ngày NT', 'ngay nt'],
    sample: '2026-01-28',
    type: 'date' as const,
  },
  {
    key: 'invoiceNo',
    header: 'SoHoaDon',
    aliases: ['invoiceNo', 'Số HĐ', 'so hd'],
    sample: 'HD-01/2026',
  },
  {
    key: 'invoiceDate',
    header: 'NgayHoaDon',
    aliases: ['invoiceDate', 'Ngày HĐ', 'ngay hd'],
    sample: '2026-01-28',
    type: 'date' as const,
  },
  {
    key: 'documentStatus',
    header: 'HoSo',
    aliases: ['documentStatus', 'Hồ sơ'],
    sample: 'SUBMITTED_UNPAID',
    type: 'select' as const,
    options: DOCUMENT_STATUSES.map((s) => ({
      value: s,
      label: documentStatusLabel[s],
    })),
  },
  {
    key: 'paymentStatus',
    header: 'ThanhToan',
    aliases: ['paymentStatus', 'Thanh toán'],
    sample: 'WAITING_CLIENT_PAYMENT',
    type: 'select' as const,
    options: ACCEPTANCE_PAYMENT_STATUSES.map((s) => ({
      value: s,
      label: acceptancePaymentStatusLabel[s],
    })),
  },
  {
    key: 'note',
    header: 'GhiChu',
    aliases: ['note', 'Ghi chú'],
    sample: 'Nghiệm thu tháng 1',
  },
];

function toIsoDate(value?: string) {
  const v = value?.trim();
  if (!v) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    return new Date(`${v}T00:00:00.000Z`).toISOString();
  }
  return new Date(v).toISOString();
}

function normalizeDocumentStatus(value: string) {
  const raw = value.trim().toUpperCase();
  if (!raw) return 'NOT_SUBMITTED' as const;
  if (
    raw === 'NOT_SUBMITTED' ||
    raw === 'CHUA_NOP' ||
    raw.includes('CHUA')
  ) {
    return 'NOT_SUBMITTED' as const;
  }
  if (
    raw === 'SUBMITTED_UNPAID' ||
    raw === 'DA_NOP' ||
    raw.includes('NOP')
  ) {
    return 'SUBMITTED_UNPAID' as const;
  }
  return null;
}

function normalizePaymentStatus(value: string, documentStatus: string) {
  if (documentStatus === 'NOT_SUBMITTED') return 'NOT_ACCEPTED' as const;
  const raw = value.trim().toUpperCase();
  if (!raw || raw === 'WAITING_CLIENT_PAYMENT' || raw === 'CHO_THANH_TOAN') {
    return 'WAITING_CLIENT_PAYMENT' as const;
  }
  if (raw === 'COLLECTED' || raw === 'DA_THU') {
    return 'COLLECTED' as const;
  }
  if (raw === 'NOT_ACCEPTED' || raw === 'CHUA_NT') return 'NOT_ACCEPTED' as const;
  return null;
}

const schema = z.object({
  manualBatch: z.string().optional(),
  period: z
    .string()
    .min(1, 'Chọn kỳ YYYY-MM')
    .refine((v) => isValidPeriod(v), {
      message: 'Kỳ phải dạng YYYY-MM',
    }),
  acceptanceDate: z.string().optional(),
  invoiceNo: z.string().optional(),
  invoiceDate: z.string().optional(),
  paymentDate: z.string().optional(),
  amount: z
    .string()
    .min(1, 'Bắt buộc')
    .refine((v) => isValidAmount(v), {
      message: 'Số tiền không hợp lệ (tối đa 2 chữ số thập phân)',
    }),
  documentStatus: z.enum(['NOT_SUBMITTED', 'SUBMITTED_UNPAID']),
  paymentStatus: z.enum([
    'NOT_ACCEPTED',
    'WAITING_CLIENT_PAYMENT',
    'COLLECTED',
  ]),
  note: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

function AgingCell({ item }: { item: Acceptance }) {
  const flow = useContractFlowLabels();
  if (item.documentStatus === 'NOT_SUBMITTED') {
    return <span className="text-slate-400">—</span>;
  }
  if (item.paymentStatus === 'COLLECTED') {
    return <span className="text-emerald-700">{flow.cashed}</span>;
  }
  if (item.agingDays == null) {
    return <span className="text-slate-400">—</span>;
  }
  if (item.agingDays > 0) {
    return (
      <span className="font-medium text-red-600">
        {flow.kind === 'INVESTOR' ? 'Quá hạn' : 'Quá hạn trả'} {item.agingDays}{' '}
        ngày
      </span>
    );
  }
  if (item.daysUntilDue != null && item.daysUntilDue > 0) {
    return (
      <span className="text-amber-700">Còn {item.daysUntilDue} ngày</span>
    );
  }
  return <span className="text-slate-600">Đến hạn</span>;
}

export function AcceptancesSection({
  contractId,
  contractNo,
  projectCode,
  planRows = [],
  contractMeta,
  items,
  onChanged,
  hideAccountingImport = false,
}: {
  contractId: string;
  contractNo: string;
  projectCode?: string;
  planRows?: PeriodComparison[];
  contractMeta?: {
    startDate?: string | null;
    endDate?: string | null;
    durationYears?: number | null;
    billingCycle: BillingCycle;
  };
  items: Acceptance[];
  onChanged: () => void;
  /** Ẩn khối import file kế toán (Nhập nhanh đã có import chung) */
  hideAccountingImport?: boolean;
}) {
  const flow = useContractFlowLabels();
  // Import file kế toán chỉ cho quản trị (BE cũng chặn)
  const isAdmin = useAuth().user?.role === 'ADMIN';
  const paymentStatusText = (s: AcceptancePaymentStatus) =>
    s === 'WAITING_CLIENT_PAYMENT'
      ? flow.waitingPayment
      : s === 'COLLECTED'
        ? flow.cashedFull
        : acceptancePaymentStatusLabel[s];
  const planOptions = planRows.filter((r) => r.revenuePlanId);
  const useLargeBatchNtPicker =
    contractMeta != null &&
    billingCycleUsesMonthlyPlanBreakdown(contractMeta.billingCycle);
  const acceptanceBatchOptions = useMemo(
    () =>
      useLargeBatchNtPicker && contractMeta
        ? buildAcceptanceBatchOptions(planRows, contractMeta)
        : [],
    [planRows, contractMeta, useLargeBatchNtPicker],
  );
  const [linkedPlanId, setLinkedPlanId] = useState('');
  const [linkedBatchSequence, setLinkedBatchSequence] = useState<number | null>(
    null,
  );

  const resolveAcceptancePlanLink = (item: {
    acceptanceNo: string;
    period: string;
  }) => {
    const row = findPlanRowForAcceptance(
      item.acceptanceNo,
      item.period,
      planOptions,
    );
    const batch =
      row?.batchSequence ??
      parseBatchSequenceFromAcceptanceNo(item.acceptanceNo);
    return { row, batch };
  };
  const [editing, setEditing] = useState<Acceptance | null>(null);
  const [viewing, setViewing] = useState<Acceptance | null>(null);
  const [attachmentFocus, setAttachmentFocus] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const existingAcceptanceNos = useMemo(
    () => items.map((i) => i.acceptanceNo),
    [items],
  );

  const acceptanceGroups = useMemo(
    () => groupAcceptancesByBatch(items),
    [items],
  );

  const openView = (item: Acceptance, focusAttachments = false) => {
    setViewing(item);
    setShowForm(false);
    setAttachmentFocus(focusAttachments);
  };

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      manualBatch: '',
      period: '',
      acceptanceDate: '',
      invoiceNo: '',
      invoiceDate: '',
      paymentDate: '',
      amount: '',
      documentStatus: 'NOT_SUBMITTED',
      paymentStatus: 'NOT_ACCEPTED',
      note: '',
    },
  });

  const documentStatus = watch('documentStatus');
  const manualBatch = watch('manualBatch');

  const linkedPlan = useMemo(
    () => planOptions.find((r) => r.revenuePlanId === linkedPlanId),
    [planOptions, linkedPlanId],
  );

  const linkedBatchOption = useMemo(
    () =>
      linkedBatchSequence != null
        ? acceptanceBatchOptions.find(
            (b) => b.batchSequence === linkedBatchSequence,
          ) ?? null
        : null,
    [acceptanceBatchOptions, linkedBatchSequence],
  );

  const autoAcceptanceNoPreview = useMemo(() => {
    const batchFromPlan = useLargeBatchNtPicker
      ? (linkedBatchOption?.batchSequence ?? null)
      : (linkedPlan?.batchSequence ?? null);
    const batchFromManual =
      manualBatch?.trim() && /^\d+$/.test(manualBatch.trim())
        ? Number(manualBatch.trim())
        : null;
    return previewAcceptanceNoForPlan({
      batchSequence: batchFromPlan ?? batchFromManual,
      existingAcceptanceNos,
      editingAcceptanceNo: editing?.acceptanceNo,
    });
  }, [
    useLargeBatchNtPicker,
    linkedBatchOption,
    linkedPlan,
    manualBatch,
    existingAcceptanceNos,
    editing?.acceptanceNo,
  ]);

  const applyLinkedPlan = (planId: string) => {
    setLinkedPlanId(planId);
    const row = planOptions.find((r) => r.revenuePlanId === planId);
    if (!row) return;
    setValue('period', row.period);
    if (row.batchSequence != null) {
      setValue('manualBatch', String(row.batchSequence));
    }
  };

  const applyLinkedBatch = (batchValue: string) => {
    if (!batchValue.trim()) {
      setLinkedBatchSequence(null);
      return;
    }
    const batchSequence = Number(batchValue);
    if (!Number.isFinite(batchSequence) || batchSequence <= 0) return;
    setLinkedBatchSequence(batchSequence);
    const opt = acceptanceBatchOptions.find(
      (b) => b.batchSequence === batchSequence,
    );
    if (opt?.defaultPeriod) {
      setValue('period', opt.defaultPeriod);
    }
    setValue('manualBatch', String(batchSequence));
  };

  const openCreate = () => {
    setEditing(null);
    setViewing(null);
    if (useLargeBatchNtPicker) {
      const first = acceptanceBatchOptions[0];
      reset({
        manualBatch: first ? String(first.batchSequence) : '',
        period: first?.defaultPeriod ?? '',
        acceptanceDate: '',
        invoiceNo: '',
        invoiceDate: '',
        paymentDate: '',
        amount: '',
        documentStatus: 'NOT_SUBMITTED',
        paymentStatus: 'NOT_ACCEPTED',
        note: '',
      });
      setLinkedBatchSequence(first?.batchSequence ?? null);
      setLinkedPlanId('');
    } else {
      const first = planOptions[0];
      reset({
        manualBatch:
          first?.batchSequence != null ? String(first.batchSequence) : '',
        period: first?.period ?? '',
        acceptanceDate: '',
        invoiceNo: '',
        invoiceDate: '',
        paymentDate: '',
        amount: '',
        documentStatus: 'NOT_SUBMITTED',
        paymentStatus: 'NOT_ACCEPTED',
        note: '',
      });
      setLinkedPlanId(first?.revenuePlanId ?? '');
      setLinkedBatchSequence(null);
    }
    setShowForm(true);
  };

  const openEdit = (item: Acceptance) => {
    setEditing(item);
    setViewing(null);
    const linked = findPlanRowForAcceptance(
      item.acceptanceNo,
      item.period,
      planOptions,
    );
    const batchFromNo = parseBatchSequenceFromAcceptanceNo(item.acceptanceNo);
    reset({
      manualBatch:
        linked?.batchSequence != null
          ? String(linked.batchSequence)
          : batchFromNo != null
            ? String(batchFromNo)
            : '',
      period: item.period,
      acceptanceDate: toDateInputValue(item.acceptanceDate),
      invoiceNo: item.invoiceNo ?? '',
      invoiceDate: toDateInputValue(item.invoiceDate),
      paymentDate: toDateInputValue(item.paymentDate),
      amount:
        normalizeAmount(String(item.amount)) ||
        parseGroupedNumber(item.amount),
      documentStatus: item.documentStatus,
      paymentStatus: item.paymentStatus,
      note: item.note ?? '',
    });
    if (useLargeBatchNtPicker) {
      setLinkedBatchSequence(batchFromNo);
      setLinkedPlanId('');
    } else {
      setLinkedPlanId(linked?.revenuePlanId ?? '');
      setLinkedBatchSequence(null);
    }
    setShowForm(true);
  };

  const onSubmit = async (values: FormValues) => {
    if (useLargeBatchNtPicker) {
      if (acceptanceBatchOptions.length > 0 && linkedBatchSequence == null) {
        toast.error('Chọn đợt nghiệm thu (theo chu kỳ HĐ)');
        return;
      }
    } else if (planOptions.length > 0 && !linkedPlanId) {
      toast.error('Chọn kỳ kế hoạch nghiệm thu');
      return;
    }

    const batchFromPlan = useLargeBatchNtPicker
      ? (linkedBatchOption?.batchSequence ?? null)
      : (linkedPlan?.batchSequence ?? null);
    const batchFromManual =
      values.manualBatch?.trim() && /^\d+$/.test(values.manualBatch.trim())
        ? Number(values.manualBatch.trim())
        : undefined;
    const batchSequence = batchFromPlan ?? batchFromManual ?? null;

    if (
      planOptions.length === 0 &&
      acceptanceBatchOptions.length === 0 &&
      batchSequence == null
    ) {
      toast.error('Nhập số đợt hoặc lập kế hoạch NT trước');
      return;
    }

    const period = values.period.trim();

    const acceptanceNo = resolveAcceptanceNoForSave({
      batchSequence,
      existingAcceptanceNos,
      editingAcceptanceNo: editing?.acceptanceNo,
    });

    const payload = {
      acceptanceNo,
      period,
      scheduleId: useLargeBatchNtPicker
        ? (linkedBatchOption?.scheduleId ?? undefined)
        : (linkedPlan?.scheduleId ?? undefined),
      revenuePlanId: useLargeBatchNtPicker
        ? undefined
        : (linkedPlan?.revenuePlanId ?? undefined),
      amount: Number(normalizeAmount(values.amount)),
      documentStatus: values.documentStatus,
      paymentStatus:
        values.documentStatus === 'NOT_SUBMITTED'
          ? ('NOT_ACCEPTED' as const)
          : values.paymentStatus,
      note: values.note || undefined,
      invoiceNo: values.invoiceNo || undefined,
      acceptanceDate: values.acceptanceDate
        ? new Date(values.acceptanceDate).toISOString()
        : undefined,
      invoiceDate: values.invoiceDate
        ? new Date(values.invoiceDate).toISOString()
        : undefined,
      // Sửa mà xóa ngày → gửi null để xóa trên BE
      paymentDate: values.paymentDate
        ? new Date(values.paymentDate).toISOString()
        : editing
          ? null
          : undefined,
    };

    try {
      if (editing) {
        await acceptancesApi.update(editing.id, payload);
        toast.success('Cập nhật nghiệm thu thành công');
      } else {
        await acceptancesApi.create(contractId, payload);
        toast.success('Thêm nghiệm thu thành công');
      }
      setShowForm(false);
      setEditing(null);
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Lưu thất bại');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await acceptancesApi.remove(id);
      toast.success('Đã xóa nghiệm thu');
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Xóa thất bại');
    }
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="text-base">{flow.acceptanceTitle}</CardTitle>
          <p className="mt-1 max-w-2xl text-xs text-slate-500">
            {flow.acceptanceIntro}{' '}
            {useLargeBatchNtPicker
              ? 'Chọn đợt theo chu kỳ HĐ — mã đợt tự sinh.'
              : 'Chọn kỳ kế hoạch tương ứng — mã đợt tự sinh.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CsvDataTransfer
            title={flow.acceptanceTitle.toLowerCase()}
            filenamePrefix={`nghiem-thu-${contractId.slice(0, 8)}`}
            hideImport
            hideTemplate
            columns={ACCEPTANCE_CSV_COLUMNS}
            sampleRows={[
              {
                acceptanceNo: 'Đợt 01/2026',
                period: '2026-01',
                amount: '500000000',
                acceptanceDate: '2026-01-28',
                invoiceNo: 'HD-01/2026',
                invoiceDate: '2026-01-28',
                documentStatus: 'SUBMITTED_UNPAID',
                paymentStatus: 'COLLECTED',
                note: 'Đã NT và đã thu',
              },
              {
                acceptanceNo: 'Đợt 02/2026',
                period: '2026-02',
                amount: '500000000',
                acceptanceDate: '2026-02-28',
                invoiceNo: 'HD-02/2026',
                invoiceDate: '2026-02-28',
                documentStatus: 'SUBMITTED_UNPAID',
                paymentStatus: 'WAITING_CLIENT_PAYMENT',
                note: 'Chờ CĐT thanh toán',
              },
              {
                acceptanceNo: 'Đợt 03/2026',
                period: '2026-03',
                amount: '500000000',
                acceptanceDate: '',
                invoiceNo: '',
                invoiceDate: '',
                paymentDate: '',
                documentStatus: 'NOT_SUBMITTED',
                paymentStatus: 'NOT_ACCEPTED',
                note: 'Chưa nộp hồ sơ',
              },
            ]}
            exportRows={items.map((item) => ({
              acceptanceNo: item.acceptanceNo,
              period: item.period,
              amount: String(item.amount),
              acceptanceDate: item.acceptanceDate?.slice(0, 10) ?? '',
              invoiceNo: item.invoiceNo ?? '',
              invoiceDate: item.invoiceDate?.slice(0, 10) ?? '',
              documentStatus: item.documentStatus,
              paymentStatus: item.paymentStatus,
              note: item.note ?? '',
            }))}
            validateRow={(row) => {
              const errors: string[] = [];
              if (!row.acceptanceNo?.trim()) errors.push('Thiếu số đợt');
              if (!isValidPeriod(row.period ?? '')) {
                errors.push('Kỳ phải dạng YYYY-MM');
              }
              if (!isValidAmount(row.amount ?? '')) {
                errors.push('Số tiền không hợp lệ');
              }
              if (!isValidOptionalDate(row.acceptanceDate ?? '')) {
                errors.push('Ngày NT phải dạng YYYY-MM-DD');
              }
              if (!isValidOptionalDate(row.invoiceDate ?? '')) {
                errors.push('Ngày HĐ phải dạng YYYY-MM-DD');
              }
              if (normalizeDocumentStatus(row.documentStatus ?? '') == null) {
                errors.push(
                  'Hồ sơ: NOT_SUBMITTED | SUBMITTED_UNPAID',
                );
              }
              const doc =
                normalizeDocumentStatus(row.documentStatus ?? '') ??
                'NOT_SUBMITTED';
              if (
                normalizePaymentStatus(row.paymentStatus ?? '', doc) == null
              ) {
                errors.push(
                  'Thanh toán: NOT_ACCEPTED | WAITING_CLIENT_PAYMENT | COLLECTED',
                );
              }
              return errors;
            }}
            onImport={async () => {}}
          />
          <WriteOnly>
            <Button size="sm" onClick={openCreate}>
              {flow.acceptanceAdd}
            </Button>
          </WriteOnly>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* File kế toán là bảng phải thu của công ty — chỉ áp cho HĐ CĐT */}
        {flow.kind === 'INVESTOR' && isAdmin && !hideAccountingImport ? (
          <CollapsibleSection
            title="Import file kế toán (bảng công ty)"
            description="Mẫu chuẩn: D = số HĐ, F/G = từ–đến ngày đợt, H = ngày HĐ, R = đợt NT. Kỳ NT gán theo ngày đợt và lịch HĐ."
            defaultOpen={false}
          >
            <AccountingAcceptanceImport
              onlyContractNo={contractNo}
              onImported={onChanged}
            />
          </CollapsibleSection>
        ) : null}

        <Dialog
          open={viewing != null}
          onOpenChange={(open) => {
            if (!open) {
              setViewing(null);
              setAttachmentFocus(false);
            }
          }}
        >
          <DialogContent className="max-w-2xl">
            {viewing ? (
              <>
                <DialogHeader>
                  <DialogTitle>{viewing.acceptanceNo}</DialogTitle>
                  <DialogDescription>
                    {flow.acceptanceTitle} · đính kèm hồ sơ
                  </DialogDescription>
                </DialogHeader>
                <DialogBody className="max-h-[min(60vh,520px)] space-y-4 overflow-y-auto">
                  <div
                    className={
                      attachmentFocus
                        ? 'rounded-lg ring-2 ring-slate-300 ring-offset-2'
                        : undefined
                    }
                  >
                    <AcceptanceAttachmentsPanel
                      acceptanceId={viewing.id}
                      acceptanceNo={viewing.acceptanceNo}
                    />
                  </div>
                  <KeyValueTable
                    rows={[
                      {
                        label: 'Khoảng đợt (KH)',
                        value: (() => {
                          const { row, batch } =
                            resolveAcceptancePlanLink(viewing);
                          if (row || batch != null) {
                            return (
                              <PlanBatchDateRange
                                batchSequence={batch}
                                periodStartDate={row?.periodStartDate}
                                periodEndDate={row?.periodEndDate}
                              />
                            );
                          }
                          return '—';
                        })(),
                      },
                      {
                        label: 'Kỳ NT (dashboard / so KH)',
                        value: formatPeriod(viewing.period),
                      },
                      {
                        label: 'Ngày NT',
                        value: formatDate(viewing.acceptanceDate),
                      },
                      { label: 'Số hóa đơn', value: viewing.invoiceNo || '—' },
                      {
                        label: 'Ngày hóa đơn',
                        value: formatDate(viewing.invoiceDate),
                      },
                      {
                        label: `Ngày ${flow.cashFlowLower}`,
                        value: formatDate(viewing.paymentDate),
                      },
                      {
                        label: 'Hạn thanh toán',
                        value: viewing.paymentDueDate
                          ? formatDate(viewing.paymentDueDate)
                          : '—',
                      },
                      {
                        label: 'Giá trị',
                        value: formatCurrencyVND(viewing.amount),
                      },
                      {
                        label: 'Hồ sơ',
                        value: (
                          <DocumentStatusBadge status={viewing.documentStatus} />
                        ),
                      },
                      {
                        label: flow.cashFlow,
                        value: (
                          <AcceptancePaymentStatusBadge
                            status={viewing.paymentStatus}
                          />
                        ),
                      },
                      {
                        label: flow.agingTitle,
                        value: <AgingCell item={viewing} />,
                      },
                      { label: 'Ghi chú', value: viewing.note || '—' },
                    ]}
                  />
                </DialogBody>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setViewing(null);
                      setAttachmentFocus(false);
                    }}
                  >
                    Đóng
                  </Button>
                  <WriteOnly>
                    <Button
                      type="button"
                      onClick={() => {
                        openEdit(viewing);
                        setViewing(null);
                      }}
                    >
                      Sửa
                    </Button>
                  </WriteOnly>
                </DialogFooter>
              </>
            ) : null}
          </DialogContent>
        </Dialog>

        <Dialog
          open={showForm}
          onOpenChange={(open) => {
            setShowForm(open);
            if (!open) setEditing(null);
          }}
        >
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editing ? `Sửa · ${flow.acceptanceTitle}` : flow.acceptanceAdd}
              </DialogTitle>
              <DialogDescription>
                {useLargeBatchNtPicker
                  ? 'Chọn đợt NT theo chu kỳ HĐ (đợt lớn). Mã NT tự sinh (Đợt n · x nếu NT nhiều lần).'
                  : 'Chọn kỳ kế hoạch (mỗi tháng một dòng). Mã NT tự sinh theo số đợt.'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)}>
              <DialogBody className="max-h-[min(58vh,480px)] space-y-3 overflow-y-auto">
                {useLargeBatchNtPicker && acceptanceBatchOptions.length > 0 ? (
                  <div className="space-y-2">
                    <Label>Chọn đợt nghiệm thu (chu kỳ HĐ) *</Label>
                    <Select
                      value={
                        linkedBatchSequence != null
                          ? String(linkedBatchSequence)
                          : ''
                      }
                      onChange={(e) => applyLinkedBatch(e.target.value)}
                    >
                      <option value="">— Chọn đợt —</option>
                      {acceptanceBatchOptions.map((b) => (
                        <option
                          key={`batch-${b.batchSequence}`}
                          value={String(b.batchSequence)}
                        >
                          {`Đợt ${b.batchSequence} · ${formatPlanBatchDateRange(b.periodStartDate, b.periodEndDate)} · KH đợt ${formatCurrencyVND(b.plannedTotal)}`}
                        </option>
                      ))}
                    </Select>
                  </div>
                ) : !useLargeBatchNtPicker && planOptions.length > 0 ? (
                  <div className="space-y-2">
                    <Label>Chọn kỳ kế hoạch nghiệm thu *</Label>
                    <Select
                      value={linkedPlanId}
                      onChange={(e) => applyLinkedPlan(e.target.value)}
                    >
                      <option value="">— Chọn kỳ —</option>
                      {planOptions.map((r) => (
                        <option key={r.revenuePlanId!} value={r.revenuePlanId!}>
                          {`Đợt ${r.batchSequence ?? '?'} · ${formatPlanBatchDateRange(r.periodStartDate, r.periodEndDate)} · KH ${formatCurrencyVND(r.plannedAmount)}`}
                        </option>
                      ))}
                    </Select>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label>Số đợt NT *</Label>
                    <Input
                      inputMode="numeric"
                      {...register('manualBatch')}
                      placeholder="10"
                    />
                    <p className="text-xs text-slate-500">
                      Chưa có kế hoạch — nhập số đợt, mã vẫn tự sinh.
                    </p>
                  </div>
                )}
                <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                  <span className="text-slate-500">Mã NT (tự sinh): </span>
                  <span className="font-semibold text-slate-900">
                    {autoAcceptanceNoPreview || '—'}
                  </span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Kỳ nghiệm thu (YYYY-MM) *</Label>
                    <Input type="month" {...register('period')} className="max-w-xs" />
                    <p className="text-xs text-slate-500">
                      Dùng so kế hoạch và bảng dashboard (không theo ngày NT).
                      Chọn đợt KH ở trên sẽ điền sẵn — có thể sửa nếu NT trễ
                      sang tháng sau (vd kỳ 2026-09, ngày NT 10/2026).
                    </p>
                    {errors.period && (
                      <p className="text-xs text-red-600">
                        {errors.period.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Ngày nghiệm thu</Label>
                    <Input type="date" {...register('acceptanceDate')} />
                  </div>
                  <div className="space-y-2">
                    <Label>Giá trị *</Label>
                    <Controller
                      name="amount"
                      control={control}
                      render={({ field }) => (
                        <MoneyInput
                          value={field.value}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                        />
                      )}
                    />
                    {errors.amount && (
                      <p className="text-xs text-red-600">
                        {errors.amount.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Số hóa đơn</Label>
                    <Input {...register('invoiceNo')} placeholder="HD-08/2026" />
                  </div>
                  <div className="space-y-2">
                    <Label>Ngày hóa đơn</Label>
                    <Input type="date" {...register('invoiceDate')} />
                  </div>
                  <div className="space-y-2">
                    <Label>Ngày {flow.cashFlowLower}</Label>
                    <Input type="date" {...register('paymentDate')} />
                    <p className="text-xs text-slate-500">
                      Ngày tiền chuyển khoản thực tế.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Trạng thái hồ sơ *</Label>
                    <Select
                      {...register('documentStatus')}
                      onChange={(e) => {
                        const value = e.target.value as FormValues['documentStatus'];
                        setValue('documentStatus', value);
                        if (value === 'NOT_SUBMITTED') {
                          setValue('paymentStatus', 'NOT_ACCEPTED');
                        } else {
                          setValue('paymentStatus', 'WAITING_CLIENT_PAYMENT');
                        }
                      }}
                    >
                      {DOCUMENT_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s === 'SUBMITTED_UNPAID'
                            ? flow.docSubmitted
                            : flow.docNotSubmitted}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Trạng thái {flow.cashFlowLower} *</Label>
                    <Select
                      {...register('paymentStatus')}
                      disabled={documentStatus === 'NOT_SUBMITTED'}
                    >
                      {ACCEPTANCE_PAYMENT_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {paymentStatusText(s)}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Ghi chú</Label>
                  <Textarea {...register('note')} rows={2} />
                </div>
                {editing ? (
                  <AcceptanceAttachmentsPanel
                    acceptanceId={editing.id}
                    acceptanceNo={editing.acceptanceNo}
                  />
                ) : null}
              </DialogBody>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowForm(false);
                    setEditing(null);
                  }}
                >
                  Hủy
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Đang lưu…' : 'Lưu'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {items.length === 0 ? (
          <p className="text-sm text-slate-500">
            Chưa có {flow.acceptanceTitle.toLowerCase()}.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table className="min-w-[1100px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Đợt / kỳ NT</TableHead>
                  <TableHead>Ngày NT</TableHead>
                  <TableHead>Số HĐ</TableHead>
                  <TableHead>Ngày HĐ</TableHead>
                  <TableHead>Giá trị</TableHead>
                  <TableHead>Hồ sơ</TableHead>
                  <TableHead>{flow.cashFlow}</TableHead>
                  <TableHead>Ngày {flow.cashFlowLower}</TableHead>
                  <TableHead>Hạn TT</TableHead>
                  <TableHead>{flow.agingTitle}</TableHead>
                  <TableHead className="text-right">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {acceptanceGroups.map((group) => {
                  const multi = group.items.length > 1;
                  const planRow =
                    group.batchSequence != null
                      ? useLargeBatchNtPicker
                        ? acceptanceBatchOptions.find(
                            (b) => b.batchSequence === group.batchSequence,
                          )
                        : planOptions.find(
                            (r) => r.batchSequence === group.batchSequence,
                          )
                      : undefined;
                  const groupTotal = sumAcceptanceAmounts(group.items);

                  return (
                    <Fragment key={group.key}>
                      {multi ? (
                        <TableRow className="bg-slate-50/90 hover:bg-slate-50/90">
                          <TableCell colSpan={11}>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                              <span className="font-semibold text-slate-900">
                                {group.batchSequence != null
                                  ? `Đợt ${group.batchSequence}`
                                  : 'Khác'}
                              </span>
                              <span className="text-slate-600">
                                {group.items.length} lần nghiệm thu
                              </span>
                              <span className="tabular-nums font-medium text-slate-800">
                                Tổng {formatCurrencyVND(String(groupTotal))}
                              </span>
                              {planRow ? (
                                <PlanBatchDateRange
                                  batchSequence={planRow.batchSequence}
                                  periodStartDate={planRow.periodStartDate}
                                  periodEndDate={planRow.periodEndDate}
                                />
                              ) : null}
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : null}
                      {group.items.map((item, index) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <div className="font-medium text-slate-900">
                              {multi ? (
                                <span className="text-slate-500">
                                  Lần {index + 1} ·{' '}
                                </span>
                              ) : null}
                              {item.acceptanceNo}
                            </div>
                            {!multi
                              ? (() => {
                                  const { row, batch } =
                                    resolveAcceptancePlanLink(item);
                                  if (row || batch != null) {
                                    return (
                                      <PlanBatchDateRange
                                        batchSequence={batch}
                                        periodStartDate={row?.periodStartDate}
                                        periodEndDate={row?.periodEndDate}
                                      />
                                    );
                                  }
                                  return (
                                    <span className="text-sm text-slate-600">
                                      {formatPeriod(item.period)}
                                    </span>
                                  );
                                })()
                              : null}
                          </TableCell>
                          <TableCell>
                            {formatDate(item.acceptanceDate)}
                          </TableCell>
                          <TableCell>{item.invoiceNo || '—'}</TableCell>
                          <TableCell>{formatDate(item.invoiceDate)}</TableCell>
                          <TableCell>
                            {formatCurrencyVND(item.amount)}
                          </TableCell>
                          <TableCell>
                            <DocumentStatusBadge status={item.documentStatus} />
                          </TableCell>
                          <TableCell>
                            <AcceptancePaymentStatusBadge
                              status={item.paymentStatus}
                            />
                          </TableCell>
                          <TableCell>{formatDate(item.paymentDate)}</TableCell>
                          <TableCell>
                            {item.paymentDueDate
                              ? formatDate(item.paymentDueDate)
                              : '—'}
                          </TableCell>
                          <TableCell>
                            <AgingCell item={item} />
                          </TableCell>
                          <TableCell>
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openView(item, false)}
                              >
                                Xem
                              </Button>
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => openView(item, true)}
                              >
                                <Paperclip className="h-4 w-4" />
                              </Button>
                              <WriteOnly>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => openEdit(item)}
                                >
                                  Sửa
                                </Button>
                              </WriteOnly>
                              <ConfirmDeleteButton
                                onConfirm={() => handleDelete(item.id)}
                                title="Xóa nghiệm thu?"
                                description={`Xóa mềm nghiệm thu ${item.acceptanceNo}.`}
                              />
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
