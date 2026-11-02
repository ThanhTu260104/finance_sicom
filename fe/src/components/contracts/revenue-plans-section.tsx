'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  contractAcceptanceSchedulePeriods,
  generateRevenuePlanWindowsFromContract,
} from '@/lib/acceptance-plan-periods';
import { RevenuePlanBatchList } from '@/components/contracts/revenue-plan-batch-list';
import { RevenuePlanFlatList } from '@/components/contracts/revenue-plan-flat-list';
import { billingCycleUsesMonthlyPlanBreakdown } from '@/lib/billing-cycle-plan-ui';
import {
  groupPlanDraftItems,
  groupRevenuePlanRows,
  type PlanDraftPreviewItem,
} from '@/lib/revenue-plan-batch-groups';
import { RevenuePlanGeneratePreview } from '@/components/contracts/revenue-plan-generate-preview';
import { periodFromDateYmd } from '@/lib/acceptance-plan-periods';
import { currentCalendarPeriod } from '@/lib/period';
import {
  PERIOD_MONTH_MAX,
  PERIOD_MONTH_MIN,
} from '@/lib/period-input-bounds';
import { Wand2 } from 'lucide-react';
import { useContractFlowLabels } from '@/lib/contract-kind';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { financialControlApi, revenuePlansApi } from '@/lib/api';
import {
  formatCurrencyVND,
  formatPeriod,
  toDateInputValue,
} from '@/lib/format';
import {
  isValidAmount,
  isValidPeriod,
  normalizeAmount,
} from '@/lib/csv';
import type {
  BillingCycle,
  ContractFinanceSummary,
  PeriodComparison,
} from '@/lib/types';
import { billingCycleLabel } from '@/components/shared/status-badges';
import { CsvDataTransfer } from '@/components/shared/csv-data-transfer';
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
  REVENUE_PLAN_CSV_COLUMNS,
  REVENUE_PLAN_CSV_SAMPLE_ROWS,
  revenuePlanCsvRowToPayload,
  revenuePlanToCsvRow,
  validateRevenuePlanCsvRow,
} from '@/lib/revenue-plan-csv';
import { WriteOnly } from '@/components/auth/auth-provider';

const schema = z
  .object({
    batchSequence: z
      .string()
      .min(1, 'Bắt buộc')
      .refine((v) => /^\d+$/.test(v) && Number(v) >= 1, {
        message: 'Số đợt ≥ 1',
      }),
    periodStartDate: z
      .string()
      .min(1, 'Bắt buộc')
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày dạng YYYY-MM-DD'),
    periodEndDate: z
      .string()
      .min(1, 'Bắt buộc')
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày dạng YYYY-MM-DD'),
    plannedAmount: z
    .string()
    .min(1, 'Bắt buộc')
    .refine((v) => !Number.isNaN(Number(v)) && Number(v) >= 0, {
      message: 'Số tiền ≥ 0',
    })
    .refine((v) => /^\d+(\.\d{1,2})?$/.test(v), {
      message: 'Tối đa 2 chữ số thập phân',
    }),
  plannedAcceptanceDate: z
    .string()
    .optional()
    .refine((v) => !v?.trim() || /^\d{4}-\d{2}-\d{2}$/.test(v), {
      message: 'Ngày dạng YYYY-MM-DD',
    }),
    note: z.string().optional(),
  })
  .refine(
    (v) => !v.periodStartDate || !v.periodEndDate || v.periodStartDate <= v.periodEndDate,
    { message: 'Từ ngày phải ≤ đến ngày', path: ['periodEndDate'] },
  );

type FormValues = z.infer<typeof schema>;

export function RevenuePlansSection({
  contractId,
  finance,
  contractMeta,
  onChanged,
}: {
  contractId: string;
  finance: ContractFinanceSummary;
  contractMeta: {
    contractValue: string | number;
    durationYears?: number | null;
    billingCycle: BillingCycle;
    startDate?: string | null;
    endDate?: string | null;
  };
  onChanged: () => void;
}) {
  const flow = useContractFlowLabels();
  const [editing, setEditing] = useState<PeriodComparison | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [autoPlanOpen, setAutoPlanOpen] = useState(false);
  const [firstPeriodZero, setFirstPeriodZero] = useState(false);
  const contractSchedulePeriods = useMemo(
    () => contractAcceptanceSchedulePeriods(contractMeta),
    [contractMeta],
  );

  const [planFromPeriod, setPlanFromPeriod] = useState('');
  const [planToPeriod, setPlanToPeriod] = useState('');

  useEffect(() => {
    if (contractSchedulePeriods.length > 0) {
      setPlanFromPeriod((prev) => prev || contractSchedulePeriods[0]);
      setPlanToPeriod(
        (prev) => prev || contractSchedulePeriods[contractSchedulePeriods.length - 1],
      );
      return;
    }
    const from = currentCalendarPeriod();
    setPlanFromPeriod((prev) => prev || from);
    const [y, m] = from.split('-').map(Number);
    const d = new Date(Date.UTC(y, m - 1 + 11, 1));
    setPlanToPeriod(
      (prev) =>
        prev ||
        `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`,
    );
  }, [contractSchedulePeriods]);
  const [planGenBusy, setPlanGenBusy] = useState(false);
  const [selectedPlanIds, setSelectedPlanIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [bulkDeleteBusy, setBulkDeleteBusy] = useState(false);

  const planRowsWithId = useMemo(
    () => finance.comparison.filter((row) => row.revenuePlanId),
    [finance.comparison],
  );

  const usesSubBatchPlanUi = billingCycleUsesMonthlyPlanBreakdown(
    contractMeta.billingCycle,
  );

  const planBatchGroups = useMemo(
    () =>
      usesSubBatchPlanUi
        ? groupRevenuePlanRows(finance.comparison, contractMeta)
        : [],
    [finance.comparison, contractMeta, usesSubBatchPlanUi],
  );

  const flatPlanRows = useMemo(
    () =>
      [...planRowsWithId].sort((a, b) => {
        if (a.batchSequence != null && b.batchSequence != null) {
          const d = a.batchSequence - b.batchSequence;
          if (d !== 0) return d;
        }
        return a.period.localeCompare(b.period);
      }),
    [planRowsWithId],
  );

  const orphanComparisonRows = useMemo(
    () => finance.comparison.filter((row) => !row.revenuePlanId),
    [finance.comparison],
  );

  const allPlansSelected =
    planRowsWithId.length > 0 &&
    planRowsWithId.every((row) => selectedPlanIds.has(row.revenuePlanId!));

  const togglePlanSelection = (id: string, checked: boolean) => {
    setSelectedPlanIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const toggleSelectAllPlans = () => {
    if (allPlansSelected) {
      setSelectedPlanIds(new Set());
      return;
    }
    setSelectedPlanIds(
      new Set(planRowsWithId.map((row) => row.revenuePlanId!)),
    );
  };

  const plannedInstallmentPeriods = useMemo(() => {
    if (!planFromPeriod || !planToPeriod || planFromPeriod > planToPeriod) {
      return [];
    }
    if (contractSchedulePeriods.length > 0) {
      return contractSchedulePeriods.filter(
        (p) => p >= planFromPeriod && p <= planToPeriod,
      );
    }
    return [];
  }, [planFromPeriod, planToPeriod, contractSchedulePeriods]);

  const acceptanceRoundCount = useMemo(() => {
    if (plannedInstallmentPeriods.length === 0) return 0;
    const start = contractMeta.startDate
      ? new Date(contractMeta.startDate)
      : null;
    const end = contractMeta.endDate ? new Date(contractMeta.endDate) : null;
    if (
      !start ||
      Number.isNaN(start.getTime()) ||
      contractMeta.durationYears == null ||
      contractMeta.durationYears <= 0
    ) {
      return 0;
    }
    const batches = new Set(
      generateRevenuePlanWindowsFromContract({
        startDate: start,
        durationYears: contractMeta.durationYears,
        billingCycle: contractMeta.billingCycle,
        endDate: end && !Number.isNaN(end.getTime()) ? end : null,
      })
        .filter(
          (w) =>
            w.period >= planFromPeriod &&
            w.period <= planToPeriod,
        )
        .map((w) => w.batchSequence),
    );
    return batches.size;
  }, [
    plannedInstallmentPeriods.length,
    planFromPeriod,
    planToPeriod,
    contractMeta.billingCycle,
    contractMeta.startDate,
    contractMeta.endDate,
    contractMeta.durationYears,
  ]);

  const planRangeInvalid = planFromPeriod > planToPeriod;
  const [planPreview, setPlanPreview] = useState<{
    items: PlanDraftPreviewItem[];
    total: string;
    contractValue: string;
  } | null>(null);

  const planPreviewGroups = useMemo(
    () =>
      planPreview && usesSubBatchPlanUi
        ? groupPlanDraftItems(planPreview.items, contractMeta)
        : [],
    [planPreview, contractMeta, usesSubBatchPlanUi],
  );

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      batchSequence: '',
      periodStartDate: '',
      periodEndDate: '',
      plannedAmount: '',
      plannedAcceptanceDate: '',
      note: '',
    },
  });

  const openCreate = () => {
    setEditing(null);
    const maxBatch = finance.comparison.reduce(
      (m, r) => Math.max(m, r.batchSequence ?? 0),
      0,
    );
    reset({
      batchSequence: String(maxBatch + 1),
      periodStartDate: '',
      periodEndDate: '',
      plannedAmount: '',
      plannedAcceptanceDate: '',
      note: '',
    });
    setShowForm(true);
  };

  const openEdit = (row: PeriodComparison) => {
    if (!row.revenuePlanId) return;
    setEditing(row);
    reset({
      batchSequence:
        row.batchSequence != null ? String(row.batchSequence) : '',
      periodStartDate: toDateInputValue(row.periodStartDate),
      periodEndDate: toDateInputValue(row.periodEndDate),
      plannedAmount: row.plannedAmount,
      plannedAcceptanceDate: toDateInputValue(row.plannedAcceptanceDate),
      note: row.note ?? '',
    });
    setShowForm(true);
  };

  const onSubmit = async (values: FormValues) => {
    const periodEnd = values.periodEndDate.trim();
    const periodStart = values.periodStartDate.trim();
    const period =
      periodFromDateYmd(periodStart) ??
      (editing?.period ? editing.period : periodFromDateYmd(periodEnd)) ??
      undefined;
    const payload = {
      period,
      batchSequence: Number(values.batchSequence),
      periodStartDate: values.periodStartDate.trim(),
      periodEndDate: periodEnd,
      plannedAmount: Number(values.plannedAmount),
      plannedAcceptanceDate: values.plannedAcceptanceDate?.trim()
        ? values.plannedAcceptanceDate.trim()
        : undefined,
      note: values.note || undefined,
    };

    try {
      if (editing?.revenuePlanId) {
        await revenuePlansApi.update(editing.revenuePlanId, payload);
        toast.success('Cập nhật kế hoạch thành công');
      } else {
        await revenuePlansApi.create(contractId, payload);
        toast.success('Thêm kế hoạch thành công');
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
      await revenuePlansApi.remove(id);
      toast.success('Đã xóa kế hoạch');
      setSelectedPlanIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Xóa thất bại');
    }
  };

  const handleBulkDeletePlans = async () => {
    const ids = [...selectedPlanIds];
    if (ids.length === 0) return;
    if (
      !window.confirm(
        `Xóa ${ids.length} kế hoạch đã chọn? Thao tác không hoàn tác.`,
      )
    ) {
      return;
    }
    setBulkDeleteBusy(true);
    try {
      const results = await Promise.allSettled(
        ids.map((id) => revenuePlansApi.remove(id)),
      );
      const failed = results.filter((r) => r.status === 'rejected').length;
      const ok = ids.length - failed;
      if (ok > 0) {
        toast.success(`Đã xóa ${ok} kế hoạch`);
        onChanged();
      }
      if (failed > 0) {
        toast.error(`${failed} dòng xóa thất bại`);
      }
      setSelectedPlanIds(new Set());
    } finally {
      setBulkDeleteBusy(false);
    }
  };

  const handlePreviewAutoPlan = async () => {
    if (planRangeInvalid || plannedInstallmentPeriods.length === 0) {
      toast.error('Chọn khoảng kỳ hợp lệ (số đợt > 0)');
      return;
    }
    setPlanGenBusy(true);
    setPlanPreview(null);
    try {
      const { periods, acceptanceRounds } =
        await financialControlApi.generatePeriods(contractId, {
          useAcceptanceSchedule: true,
          startPeriod: planFromPeriod,
          endPeriod: planToPeriod,
        });
      const draft = await financialControlApi.draftEqualSplit(contractId, {
        periods,
        firstPeriodZero,
      });
      setPlanPreview({
        items: draft.items.map((item) => ({
          period: item.period,
          plannedAmount: item.plannedAmount,
          batchSequence: item.batchSequence,
          periodStartDate: item.periodStartDate ?? null,
          periodEndDate: item.periodEndDate ?? null,
        })),
        total: draft.total,
        contractValue: draft.contractValue,
      });
      toast.success(
        `Xem trước ${periods.length} dòng KH tháng` +
          (acceptanceRounds != null
            ? ` · ${acceptanceRounds} lần NT (theo chu kỳ HĐ)`
            : ''),
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Không sinh được kế hoạch',
      );
    } finally {
      setPlanGenBusy(false);
    }
  };

  const handleApplyAutoPlan = async () => {
    if (planRangeInvalid || plannedInstallmentPeriods.length === 0) {
      toast.error('Chọn khoảng kỳ hợp lệ (số đợt > 0)');
      return;
    }
    if (
      !window.confirm(
        'Xóa toàn bộ kế hoạch cũ của hợp đồng này và lưu bản chia đều mới?',
      )
    ) {
      return;
    }
    setPlanGenBusy(true);
    try {
      await financialControlApi.bulkPlans(contractId, {
        generateFromAcceptanceSchedule: true,
        equalSplit: true,
        firstPeriodZero,
        replaceExisting: true,
        startPeriod: planFromPeriod,
        endPeriod: planToPeriod,
      });
      toast.success('Đã lưu kế hoạch chia đều');
      setPlanPreview(null);
      setAutoPlanOpen(false);
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Lưu kế hoạch thất bại');
    } finally {
      setPlanGenBusy(false);
    }
  };

  const handleImportCsv = async (rows: Array<Record<string, string>>) => {
    await financialControlApi.bulkPlans(contractId, {
      items: rows.map((row) => revenuePlanCsvRowToPayload(row)),
    });
    onChanged();
  };

  return (
    <div className="space-y-4">
      <Dialog
        open={showForm}
        onOpenChange={(open) => {
          setShowForm(open);
          if (!open) setEditing(null);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing ? `Sửa · ${flow.planTitle}` : 'Thêm kỳ kế hoạch'}
            </DialogTitle>
            <DialogDescription>
              Mỗi dòng là một đợt: bạn tự quy định từ ngày → đến ngày và số đợt
              (3 tháng, 6 tháng… tùy HĐ).
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)}>
            <DialogBody className="space-y-3">
              <div className="space-y-2">
                <Label>Số đợt NT *</Label>
                <Input
                  inputMode="numeric"
                  {...register('batchSequence')}
                  placeholder="1"
                />
                {errors.batchSequence && (
                  <p className="text-xs text-red-600">
                    {errors.batchSequence.message}
                  </p>
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Từ ngày *</Label>
                  <Input type="date" {...register('periodStartDate')} />
                  {errors.periodStartDate && (
                    <p className="text-xs text-red-600">
                      {errors.periodStartDate.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Đến ngày *</Label>
                  <Input type="date" {...register('periodEndDate')} />
                  {errors.periodEndDate && (
                    <p className="text-xs text-red-600">
                      {errors.periodEndDate.message}
                    </p>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Số tiền kế hoạch *</Label>
                <Controller
                  name="plannedAmount"
                  control={control}
                  render={({ field }) => (
                    <MoneyInput
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                    />
                  )}
                />
                {errors.plannedAmount && (
                  <p className="text-xs text-red-600">
                    {errors.plannedAmount.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Ngày NT dự kiến</Label>
                <Input type="date" {...register('plannedAcceptanceDate')} />
                {errors.plannedAcceptanceDate && (
                  <p className="text-xs text-red-600">
                    {errors.plannedAcceptanceDate.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Ghi chú</Label>
                <Textarea {...register('note')} rows={2} />
              </div>
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

      <Dialog
        open={autoPlanOpen}
        onOpenChange={(open) => {
          setAutoPlanOpen(open);
          if (!open) setPlanPreview(null);
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Sinh kế hoạch chia đều</DialogTitle>
            <DialogDescription>
              {usesSubBatchPlanUi
                ? 'Chia GT HĐ theo đợt NT (chu kỳ HĐ), mỗi đợt chia đều các tháng con (1-1, 1-2…). Lưu thay toàn bộ KH cũ.'
                : 'Chia đều giá trị HĐ theo từng kỳ NT (mỗi tháng một dòng). Lưu thay toàn bộ kế hoạch cũ.'}
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="plan-from-period" className="text-xs">
                  Kỳ KH tháng từ
                </Label>
                <Input
                  id="plan-from-period"
                  type="month"
                  min={PERIOD_MONTH_MIN}
                  max={PERIOD_MONTH_MAX}
                  value={planFromPeriod}
                  onChange={(e) => {
                    setPlanPreview(null);
                    setPlanFromPeriod(e.target.value);
                  }}
                  className="bg-white"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="plan-to-period" className="text-xs">
                  Đến kỳ KH tháng
                </Label>
                <Input
                  id="plan-to-period"
                  type="month"
                  min={PERIOD_MONTH_MIN}
                  max={PERIOD_MONTH_MAX}
                  value={planToPeriod}
                  onChange={(e) => {
                    setPlanPreview(null);
                    setPlanToPeriod(e.target.value);
                  }}
                  className="bg-white"
                />
              </div>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
              {planRangeInvalid ? (
                <p className="text-red-600">Kỳ bắt đầu phải ≤ kỳ đến.</p>
              ) : (
                <p className="font-medium text-slate-900">
                  Dòng KH chi tiết (theo tháng):{' '}
                  <span className="tabular-nums text-teal-800">
                    {plannedInstallmentPeriods.length}
                  </span>
                  {acceptanceRoundCount > 0 ? (
                    <>
                      {' · '}
                      Lần NT (chu kỳ HĐ):{' '}
                      <span className="tabular-nums text-teal-800">
                        {acceptanceRoundCount}
                      </span>
                    </>
                  ) : null}
                  {' · '}
                  {billingCycleLabel[contractMeta.billingCycle] ?? '—'}
                </p>
              )}
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={firstPeriodZero}
                onChange={(e) => {
                  setFirstPeriodZero(e.target.checked);
                  setPlanPreview(null);
                }}
                className="rounded border-slate-300"
              />
              Đợt NT đầu = 0 (cả các tháng con; chia GT HĐ cho các đợt sau)
            </label>
            {planPreview && usesSubBatchPlanUi && planPreviewGroups.length > 0 ? (
              <RevenuePlanGeneratePreview
                groups={planPreviewGroups}
                total={planPreview.total}
                contractValue={planPreview.contractValue}
              />
            ) : planPreview && !usesSubBatchPlanUi ? (
              <RevenuePlanGeneratePreview
                groups={[
                  {
                    batchSequence: 0,
                    batchPeriodStartDate: null,
                    batchPeriodEndDate: null,
                    plannedTotal: planPreview.total,
                    slices: planPreview.items,
                  },
                ]}
                total={planPreview.total}
                contractValue={planPreview.contractValue}
                flatMonthly
              />
            ) : (
              <p className="text-xs text-slate-500">
                Bấm Xem trước để kiểm tra từng đợt và tháng con trước khi lưu.
              </p>
            )}
          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setAutoPlanOpen(false)}
            >
              Đóng
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={
                planGenBusy ||
                planRangeInvalid ||
                plannedInstallmentPeriods.length === 0
              }
              onClick={() => void handlePreviewAutoPlan()}
            >
              <Wand2 className="h-4 w-4" />
              Xem trước
            </Button>
            <Button
              type="button"
              disabled={
                planGenBusy ||
                planRangeInvalid ||
                plannedInstallmentPeriods.length === 0
              }
              onClick={() => void handleApplyAutoPlan()}
            >
              Lưu — thay toàn bộ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base">{flow.planTitle}</CardTitle>
            <p className="mt-1 text-sm font-normal text-slate-500">
              {usesSubBatchPlanUi
                ? 'HĐ nghiệm thu theo chu kỳ (vd 3 tháng/lần): KH chi tiết tách từng tháng trong đợt để khớp bảng KPI tháng.'
                : 'HĐ nghiệm thu hàng tháng: mỗi kỳ một dòng kế hoạch, khớp nghiệm thu theo kỳ.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <CsvDataTransfer
              title={flow.planTitle.toLowerCase()}
              filenamePrefix={`ke-hoach-${contractId.slice(0, 8)}`}
              columns={[...REVENUE_PLAN_CSV_COLUMNS]}
              sampleRows={REVENUE_PLAN_CSV_SAMPLE_ROWS}
              exportRows={finance.comparison
                .filter((row) => row.revenuePlanId)
                .map((row) =>
                  revenuePlanToCsvRow({
                    batchSequence: row.batchSequence,
                    periodStartDate: row.periodStartDate,
                    periodEndDate: row.periodEndDate,
                    period: row.period,
                    plannedAmount: row.plannedAmount,
                    plannedAcceptanceDate: row.plannedAcceptanceDate,
                    note: row.note,
                  }),
                )}
              validateRow={validateRevenuePlanCsvRow}
              onImport={handleImportCsv}
            />
            {selectedPlanIds.size > 0 ? (
              <WriteOnly>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={bulkDeleteBusy}
                  onClick={() => void handleBulkDeletePlans()}
                >
                  {bulkDeleteBusy
                    ? 'Đang xóa…'
                    : `Xóa đã chọn (${selectedPlanIds.size})`}
                </Button>
              </WriteOnly>
            ) : null}
            <WriteOnly>
              <Button size="sm" onClick={openCreate}>
                Thêm kỳ
              </Button>
            </WriteOnly>
            <WriteOnly>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setAutoPlanOpen(true)}
              >
                <Wand2 className="h-4 w-4" />
                Sinh kế hoạch chia đều
              </Button>
            </WriteOnly>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!finance.planMatchesContractValue && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Tổng các đợt đã lập ({formatCurrencyVND(finance.totalPlanned)}) khác giá
              trị hợp đồng ({formatCurrencyVND(finance.contractValue)}). Nếu hợp đồng còn các
              đợt chưa đến hạn, hãy bổ sung thêm các kỳ tương ứng.
            </div>
          )}

          {planRowsWithId.length === 0 ? (
            <p className="text-sm text-slate-500">
              Chưa có {flow.planTitle.toLowerCase()}.
            </p>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={allPlansSelected}
                  onChange={toggleSelectAllPlans}
                  aria-label="Chọn tất cả kế hoạch"
                  className="rounded border-slate-300"
                />
                <span>
                  {usesSubBatchPlanUi
                    ? 'Chọn tất cả dòng KH tháng'
                    : 'Chọn tất cả kế hoạch'}
                </span>
              </div>
              {usesSubBatchPlanUi ? (
                <RevenuePlanBatchList
                  groups={planBatchGroups}
                  selectedPlanIds={selectedPlanIds}
                  onTogglePlan={togglePlanSelection}
                  onEdit={openEdit}
                  onDelete={handleDelete}
                />
              ) : (
                <RevenuePlanFlatList
                  rows={flatPlanRows}
                  selectedPlanIds={selectedPlanIds}
                  onTogglePlan={togglePlanSelection}
                  onEdit={openEdit}
                  onDelete={handleDelete}
                />
              )}
            </div>
          )}
          {orphanComparisonRows.length > 0 ? (
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
              <p className="font-medium text-slate-800">
                Kỳ có thực tế chưa gắn dòng KH ({orphanComparisonRows.length})
              </p>
              <ul className="mt-1 list-disc pl-5 text-xs">
                {orphanComparisonRows.map((row) => (
                  <li key={`orphan-${row.period}`}>
                    {formatPeriod(row.period)} — NT{' '}
                    {formatCurrencyVND(row.actualAmount ?? '0')}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
