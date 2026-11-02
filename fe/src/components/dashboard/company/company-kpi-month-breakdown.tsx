'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Check, Pencil, X } from 'lucide-react';
import { toast } from 'sonner';
import type {
  DashboardKpiMonthBreakdown,
  DashboardKpiOverdueAcceptanceNote,
} from '@/lib/types';
import { revenuePlansApi } from '@/lib/api';
import {
  formatCurrencyVND,
  formatDate,
  formatPeriod,
  formatPlanAcceptanceGapVND,
  compareDecimalStrings,
} from '@/lib/format';
import {
  subtractDecimalInt,
  sumDecimalIntStrings,
} from '@/lib/decimal-gap';
import { formatPlanSliceDisplayLabel } from '@/lib/revenue-plan-batch-groups';
import { billingCycleUsesMonthlyPlanBreakdown } from '@/lib/billing-cycle-plan-ui';
import type { BillingCycle } from '@/lib/types';
import { shiftPeriodMonths } from '@/lib/period-shift';
import { MoneyInput } from '@/components/ui/money-input';

function planSliceLabel(
  slice: {
    batchSequence?: number | null;
    subBatchIndex?: number | null;
    period?: string;
  },
  billingCycle?: BillingCycle,
) {
  return formatPlanSliceDisplayLabel(
    slice,
    billingCycle != null &&
      billingCycleUsesMonthlyPlanBreakdown(billingCycle),
  );
}
import { Button } from '@/components/ui/button';
import {
  sortDashboardRows,
  useDashboardTableSort,
} from '@/lib/dashboard-table-sort';
import { cn } from '@/lib/utils';
import { Select } from '@/components/ui/select';
import {
  DashboardFilterField,
  DashboardMonthInput,
  DashboardPanelHeader,
  dashboardPanelShellClass,
} from '@/components/dashboard/company/dashboard-panel-header';
import {
  DashboardDataTable,
  DashboardHead,
  SortableDashboardHead,
  DashboardMoneyCell,
  DashboardStickyHeader,
  DashboardTableBody,
  DashboardTableRow,
  DashboardTextCell,
} from '@/components/dashboard/company/dashboard-data-table-shell';
import { WriteOnly } from '@/components/auth/auth-provider';

/** Tạm ẩn cột ghi chú đợt NT quá hạn — bật lại khi cần. */
const SHOW_OVERDUE_ACCEPTANCE_NOTE_COLUMN = false;

const UNASSIGNED_KST = '__unassigned_kst__';
const NEW_PLAN_DRAFT_KEY = '__new__';
const NEW_NEXT_PLAN_DRAFT_KEY = '__new_next__';

function plannedDraftTotal(
  drafts: Record<string, string> | undefined,
): string {
  if (!drafts) return '0';
  return sumDecimalIntStrings(Object.values(drafts));
}

function gapPlannedMinusActual(planned: string, actual: string): string {
  return subtractDecimalInt(planned, actual).toString();
}

function buildInitialPlanDrafts(
  rows: DashboardKpiMonthBreakdown['rows'],
): Record<string, Record<string, string>> {
  const out: Record<string, Record<string, string>> = {};
  for (const row of rows) {
    const slices = row.revenuePlansInPeriod ?? [];
    const byPlan: Record<string, string> = {};
    if (slices.length > 0) {
      for (const slice of slices) {
        byPlan[slice.id] = slice.plannedAmount;
      }
    } else {
      byPlan[NEW_PLAN_DRAFT_KEY] =
        compareDecimalStrings(row.plannedAmount, '0') > 0
          ? row.plannedAmount
          : '';
    }
    out[row.contractId] = byPlan;
  }
  return out;
}

function buildInitialNextPlanDrafts(
  rows: DashboardKpiMonthBreakdown['rows'],
): Record<string, Record<string, string>> {
  const out: Record<string, Record<string, string>> = {};
  for (const row of rows) {
    const slices = row.revenuePlansInNextPeriod ?? [];
    const byPlan: Record<string, string> = {};
    if (slices.length > 0) {
      for (const slice of slices) {
        byPlan[slice.id] = slice.plannedAmount;
      }
    } else {
      byPlan[NEW_NEXT_PLAN_DRAFT_KEY] =
        compareDecimalStrings(row.nextPlannedAmount ?? '0', '0') > 0
          ? (row.nextPlannedAmount ?? '')
          : '';
    }
    out[row.contractId] = byPlan;
  }
  return out;
}

type KpiBreakdownSortKey =
  | 'projectCode'
  | 'contractNo'
  | 'plannedAmount'
  | 'actualAcceptance'
  | 'collectedAmount'
  | 'acceptanceGap'
  | 'nextPlannedAmount';

function sumMoneyColumn(
  rows: DashboardKpiMonthBreakdown['rows'],
  key:
    | 'plannedAmount'
    | 'actualAcceptance'
    | 'collectedAmount'
    | 'acceptanceGap'
    | 'nextPlannedAmount',
) {
  return sumDecimalIntStrings(rows.map((row) => row[key] ?? '0'));
}

function BreakdownPeriodHeader({
  periodKey,
  onPeriodChange,
  periodPickerId,
  hidePeriodPicker = false,
  projectFilter,
  onProjectFilterChange,
  projectOptions,
  kstFilter,
  onKstFilterChange,
  kstOptions,
}: {
  periodKey: string;
  onPeriodChange: (period: string) => void;
  periodPickerId: string;
  hidePeriodPicker?: boolean;
  projectFilter: string;
  onProjectFilterChange: (value: string) => void;
  projectOptions: Array<{ id: string; label: string }>;
  kstFilter: string;
  onKstFilterChange: (value: string) => void;
  kstOptions: Array<{ key: string; label: string }>;
}) {
  const label = formatPeriod(periodKey);
  return (
    <DashboardPanelHeader
      title={`Chi tiết kế hoạch · nghiệm thu · thu tiền — tháng ${label}`}
      description="Hợp đồng có số tiền lớn nhất hiển thị trước"
      filters={
        <>
          {hidePeriodPicker ? null : (
            <DashboardFilterField id={periodPickerId} label="Tháng / năm">
              <DashboardMonthInput
                id={periodPickerId}
                value={periodKey}
                onChange={onPeriodChange}
              />
            </DashboardFilterField>
          )}
          <DashboardFilterField
            id="kpi-breakdown-project"
            label="Dự án"
            className="w-[13rem]"
          >
            <Select
              id="kpi-breakdown-project"
              className="h-9 bg-white"
              value={projectFilter}
              onChange={(e) => onProjectFilterChange(e.target.value)}
            >
              <option value="">Tất cả dự án</option>
              {projectOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </Select>
          </DashboardFilterField>
          <DashboardFilterField
            id="kpi-breakdown-kst"
            label="Kỹ sư trưởng"
            className="w-[13rem]"
          >
            <Select
              id="kpi-breakdown-kst"
              className="h-9 bg-white"
              value={kstFilter}
              onChange={(e) => onKstFilterChange(e.target.value)}
            >
              <option value="">Tất cả KST</option>
              {kstOptions.map((k) => (
                <option key={k.key} value={k.key}>
                  {k.label}
                </option>
              ))}
            </Select>
          </DashboardFilterField>
        </>
      }
    />
  );
}

export function CompanyKpiMonthBreakdown({
  breakdown,
  kpiPeriod,
  onKpiPeriodChange,
  metricsStale = false,
  periodPickerId = 'kpi-breakdown-period',
  hidePeriodPicker = false,
  embedded = false,
  onRefresh,
}: {
  breakdown: DashboardKpiMonthBreakdown;
  kpiPeriod: string;
  onKpiPeriodChange: (period: string) => void;
  metricsStale?: boolean;
  periodPickerId?: string;
  /** Dùng khi tháng đã chọn ở header trình chiếu */
  hidePeriodPicker?: boolean;
  /** Bỏ viền ngoài — nằm trong panel trình chiếu */
  embedded?: boolean;
  /** Sau khi lưu kế hoạch — tải lại dashboard */
  onRefresh?: () => void | Promise<void>;
}) {
  const periodKey = kpiPeriod.trim() || breakdown.period;
  const nextPeriodKey =
    breakdown.nextPeriod ?? shiftPeriodMonths(periodKey, 1);
  const stale = metricsStale || breakdown.period !== periodKey;
  const [projectFilter, setProjectFilter] = useState('');
  const [kstFilter, setKstFilter] = useState('');
  const { sort, toggleSort } = useDashboardTableSort<KpiBreakdownSortKey>(
    'plannedAmount',
    true,
  );
  const [planEditMode, setPlanEditMode] = useState(false);
  const [planDrafts, setPlanDrafts] = useState<
    Record<string, Record<string, string>>
  >({});
  const [nextPlanDrafts, setNextPlanDrafts] = useState<
    Record<string, Record<string, string>>
  >({});
  const [planSaving, setPlanSaving] = useState(false);

  const enterPlanEditMode = useCallback(() => {
    setPlanDrafts(buildInitialPlanDrafts(breakdown.rows));
    setNextPlanDrafts(buildInitialNextPlanDrafts(breakdown.rows));
    setPlanEditMode(true);
  }, [breakdown.rows]);

  const cancelPlanEdit = useCallback(() => {
    setPlanEditMode(false);
    setPlanDrafts({});
    setNextPlanDrafts({});
  }, []);

  useEffect(() => {
    if (!planEditMode) return;
    setPlanDrafts(buildInitialPlanDrafts(breakdown.rows));
    setNextPlanDrafts(buildInitialNextPlanDrafts(breakdown.rows));
  }, [breakdown.rows, planEditMode]);

  const updatePlanDraft = useCallback(
    (contractId: string, planKey: string, value: string) => {
      setPlanDrafts((prev) => ({
        ...prev,
        [contractId]: {
          ...(prev[contractId] ?? {}),
          [planKey]: value,
        },
      }));
    },
    [],
  );

  const updateNextPlanDraft = useCallback(
    (contractId: string, planKey: string, value: string) => {
      setNextPlanDrafts((prev) => ({
        ...prev,
        [contractId]: {
          ...(prev[contractId] ?? {}),
          [planKey]: value,
        },
      }));
    },
    [],
  );

  const savePlanEdits = useCallback(async () => {
    setPlanSaving(true);
    try {
      const tasks: Promise<unknown>[] = [];
      for (const row of breakdown.rows) {
        const drafts = planDrafts[row.contractId];
        if (drafts) {
          const slices = row.revenuePlansInPeriod ?? [];
          for (const slice of slices) {
            const next = drafts[slice.id]?.trim() ?? '';
            if (next === slice.plannedAmount) continue;
            tasks.push(
              revenuePlansApi.update(slice.id, {
                plannedAmount: Number(next || 0),
              }),
            );
          }
          const newAmount = drafts[NEW_PLAN_DRAFT_KEY]?.trim();
          if (
            slices.length === 0 &&
            newAmount &&
            compareDecimalStrings(newAmount, '0') > 0
          ) {
            tasks.push(
              revenuePlansApi.create(row.contractId, {
                period: periodKey,
                plannedAmount: Number(newAmount),
              }),
            );
          }
        }

        const nextDrafts = nextPlanDrafts[row.contractId];
        if (!nextDrafts) continue;
        const nextSlices = row.revenuePlansInNextPeriod ?? [];
        for (const slice of nextSlices) {
          const next = nextDrafts[slice.id]?.trim() ?? '';
          if (next === slice.plannedAmount) continue;
          tasks.push(
            revenuePlansApi.update(slice.id, {
              plannedAmount: Number(next || 0),
            }),
          );
        }
        const newNextAmount = nextDrafts[NEW_NEXT_PLAN_DRAFT_KEY]?.trim();
        if (
          nextSlices.length === 0 &&
          newNextAmount &&
          compareDecimalStrings(newNextAmount, '0') > 0
        ) {
          tasks.push(
            revenuePlansApi.create(row.contractId, {
              period: nextPeriodKey,
              plannedAmount: Number(newNextAmount),
            }),
          );
        }
      }
      if (tasks.length === 0) {
        toast.message('Không có thay đổi để lưu');
        setPlanEditMode(false);
        return;
      }
      await Promise.all(tasks);
      toast.success('Đã cập nhật kế hoạch nghiệm thu');
      setPlanEditMode(false);
      setPlanDrafts({});
      setNextPlanDrafts({});
      await onRefresh?.();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Không lưu được kế hoạch',
      );
    } finally {
      setPlanSaving(false);
    }
  }, [
    breakdown.rows,
    nextPeriodKey,
    nextPlanDrafts,
    onRefresh,
    periodKey,
    planDrafts,
  ]);

  const projectOptions = useMemo(() => {
    const byId = new Map<string, string>();
    for (const row of breakdown.rows) {
      if (!byId.has(row.projectId)) {
        byId.set(row.projectId, `${row.projectCode} — ${row.projectName}`);
      }
    }
    return [...byId.entries()]
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label, 'vi'));
  }, [breakdown.rows]);

  const kstOptions = useMemo(() => {
    const names = new Set<string>();
    let hasUnassigned = false;
    for (const row of breakdown.rows) {
      const name = row.projectManagerName?.trim();
      if (name) names.add(name);
      else hasUnassigned = true;
    }
    const options = [...names]
      .sort((a, b) => a.localeCompare(b, 'vi'))
      .map((name) => ({ key: name, label: name }));
    if (hasUnassigned) {
      options.push({ key: UNASSIGNED_KST, label: 'Chưa gán KST' });
    }
    return options;
  }, [breakdown.rows]);

  useEffect(() => {
    if (projectFilter && !projectOptions.some((p) => p.id === projectFilter)) {
      setProjectFilter('');
    }
  }, [projectFilter, projectOptions]);

  useEffect(() => {
    if (kstFilter && !kstOptions.some((k) => k.key === kstFilter)) {
      setKstFilter('');
    }
  }, [kstFilter, kstOptions]);

  const headerProps = {
    periodKey,
    onPeriodChange: onKpiPeriodChange,
    periodPickerId,
    hidePeriodPicker,
    projectFilter,
    onProjectFilterChange: setProjectFilter,
    projectOptions,
    kstFilter,
    onKstFilterChange: setKstFilter,
    kstOptions,
  };

  const shellClass = embedded
    ? 'overflow-hidden rounded-lg border border-slate-200 bg-white'
    : dashboardPanelShellClass;

  const filteredRows = useMemo(() => {
    return breakdown.rows.filter((row) => {
      if (projectFilter && row.projectId !== projectFilter) return false;
      if (!kstFilter) return true;
      const pm = row.projectManagerName?.trim() || null;
      if (kstFilter === UNASSIGNED_KST) return pm == null;
      return pm === kstFilter;
    });
  }, [breakdown.rows, projectFilter, kstFilter]);

  const rows = useMemo(
    () =>
      sortDashboardRows(
        filteredRows,
        sort,
        (row, key) => {
          switch (key) {
            case 'projectCode':
              return row.projectCode;
            case 'contractNo':
              return row.contractNo;
            case 'plannedAmount':
              return row.plannedAmount;
            case 'actualAcceptance':
              return row.actualAcceptance;
            case 'collectedAmount':
              return row.collectedAmount;
            case 'acceptanceGap':
              return row.acceptanceGap;
            case 'nextPlannedAmount':
              return row.nextPlannedAmount ?? '0';
            default:
              return '0';
          }
        },
        (key) => (key === 'projectCode' || key === 'contractNo' ? 'locale' : 'decimal'),
      ),
    [filteredRows, sort],
  );

  if (breakdown.rows.length === 0) {
    return (
      <div className={shellClass}>
        <BreakdownPeriodHeader {...headerProps} />
        <p
          className={cn(
            'px-4 py-6 text-center text-sm text-slate-500 transition-opacity',
            stale && 'opacity-60',
          )}
        >
          Không có số liệu trong tháng {formatPeriod(periodKey)}.
        </p>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className={shellClass}>
        <BreakdownPeriodHeader {...headerProps} />
        <p
          className={cn(
            'px-4 py-6 text-center text-sm text-slate-500 transition-opacity',
            stale && 'opacity-60',
          )}
        >
          Không có hợp đồng phù hợp bộ lọc trong tháng {formatPeriod(periodKey)}.
        </p>
      </div>
    );
  }

  const totalPlanned = planEditMode
    ? sumDecimalIntStrings(
        rows.map((row) => plannedDraftTotal(planDrafts[row.contractId])),
      )
    : sumMoneyColumn(rows, 'plannedAmount');
  const totalAccepted = sumMoneyColumn(rows, 'actualAcceptance');
  const totalNextPlanned = planEditMode
    ? sumDecimalIntStrings(
        rows.map((row) =>
          plannedDraftTotal(nextPlanDrafts[row.contractId]),
        ),
      )
    : sumMoneyColumn(rows, 'nextPlannedAmount');
  const totalCollected = sumMoneyColumn(rows, 'collectedAmount');
  const totalGap = planEditMode
    ? sumDecimalIntStrings(
        rows.map((row) => {
          const planned = plannedDraftTotal(planDrafts[row.contractId]);
          return gapPlannedMinusActual(planned, row.actualAcceptance);
        }),
      )
    : sumMoneyColumn(rows, 'acceptanceGap');

  return (
    <div className={shellClass}>
      <BreakdownPeriodHeader {...headerProps} />
      {planEditMode ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-amber-50/80 px-4 py-2">
          <p className="text-xs text-amber-950">
            Đang chỉnh <strong>kế hoạch nghiệm thu</strong> tháng{' '}
            {formatPeriod(periodKey)} và {formatPeriod(nextPeriodKey)} — sửa số
            tiền rồi bấm Lưu.
          </p>
          <div className="ml-auto flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={cancelPlanEdit}
              disabled={planSaving}
            >
              <X className="mr-1 h-3.5 w-3.5" />
              Hủy
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => void savePlanEdits()}
              disabled={planSaving}
            >
              <Check className="mr-1 h-3.5 w-3.5" />
              {planSaving ? 'Đang lưu…' : 'Lưu kế hoạch'}
            </Button>
          </div>
        </div>
      ) : null}
      <div className={cn(stale && 'opacity-60 transition-opacity')}>
      <DashboardDataTable
        minWidth={SHOW_OVERDUE_ACCEPTANCE_NOTE_COLUMN ? '68rem' : '58rem'}
        footer={
          <DashboardTableBody>
            <DashboardTableRow className="bg-slate-50/90 font-semibold hover:bg-slate-50/90 [&_td]:border-t [&_td]:border-slate-200/80 [&_td]:border-b-0">
              <DashboardTextCell colSpan={2} className="text-slate-800">
                Tổng ({rows.length} hợp đồng)
              </DashboardTextCell>
              <DashboardMoneyCell>{formatCurrencyVND(totalPlanned)}</DashboardMoneyCell>
              <DashboardMoneyCell>{formatCurrencyVND(totalAccepted)}</DashboardMoneyCell>
              <DashboardMoneyCell>{formatCurrencyVND(totalCollected)}</DashboardMoneyCell>
              <DashboardMoneyCell
                emphasize={
                  compareDecimalStrings(totalGap, '0') > 0 ? 'amber' : undefined
                }
                className={
                  compareDecimalStrings(totalGap, '0') < 0
                    ? 'font-medium text-emerald-700'
                    : undefined
                }
              >
                {formatPlanAcceptanceGapVND(totalGap)}
              </DashboardMoneyCell>
              <DashboardMoneyCell>
                {formatCurrencyVND(totalNextPlanned)}
              </DashboardMoneyCell>
              {SHOW_OVERDUE_ACCEPTANCE_NOTE_COLUMN ? (
                <DashboardTextCell className="text-slate-400">—</DashboardTextCell>
              ) : null}
            </DashboardTableRow>
          </DashboardTableBody>
        }
      >
        <DashboardStickyHeader>
          <SortableDashboardHead
            columnKey="projectCode"
            sortKey={sort.key}
            sortDesc={sort.desc}
            onSort={toggleSort}
            width="14%"
          >
            Mã dự án
          </SortableDashboardHead>
          <SortableDashboardHead
            columnKey="contractNo"
            sortKey={sort.key}
            sortDesc={sort.desc}
            onSort={toggleSort}
            width="22%"
          >
            Hợp đồng
          </SortableDashboardHead>
          <SortableDashboardHead
            columnKey="plannedAmount"
            sortKey={sort.key}
            sortDesc={sort.desc}
            onSort={toggleSort}
            align="right"
            width="14%"
          >
            <span className="inline-flex items-center justify-end gap-1">
              <span>Kế hoạch nghiệm thu</span>
              <WriteOnly>
                <button
                  type="button"
                  title={
                    planEditMode
                      ? 'Đang chỉnh kế hoạch'
                      : 'Chỉnh kế hoạch nghiệm thu tại bảng'
                  }
                  aria-pressed={planEditMode}
                  className={cn(
                    'rounded p-0.5 hover:bg-slate-200/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-slate-400',
                    planEditMode && 'bg-slate-800 text-white hover:bg-slate-700',
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (planEditMode) cancelPlanEdit();
                    else enterPlanEditMode();
                  }}
                >
                  <Pencil className="h-3.5 w-3.5 shrink-0" aria-hidden />
                </button>
              </WriteOnly>
            </span>
          </SortableDashboardHead>
          <SortableDashboardHead
            columnKey="actualAcceptance"
            sortKey={sort.key}
            sortDesc={sort.desc}
            onSort={toggleSort}
            align="right"
            width="14%"
          >
            NT thực tế
          </SortableDashboardHead>
          <SortableDashboardHead
            columnKey="collectedAmount"
            sortKey={sort.key}
            sortDesc={sort.desc}
            onSort={toggleSort}
            align="right"
            width="14%"
          >
            Thu tiền
          </SortableDashboardHead>
          <SortableDashboardHead
            columnKey="acceptanceGap"
            sortKey={sort.key}
            sortDesc={sort.desc}
            onSort={toggleSort}
            align="right"
            width="18%"
          >
            Chênh lệch kế hoạch − nghiệm thu
          </SortableDashboardHead>
          <SortableDashboardHead
            columnKey="nextPlannedAmount"
            sortKey={sort.key}
            sortDesc={sort.desc}
            onSort={toggleSort}
            align="right"
            width="14%"
          >
            <span className="inline-flex items-center justify-end gap-1">
              <span>KH tháng {formatPeriod(nextPeriodKey)}</span>
              <WriteOnly>
                <button
                  type="button"
                  title={
                    planEditMode
                      ? 'Đang chỉnh kế hoạch'
                      : 'Chỉnh kế hoạch tháng tiếp theo'
                  }
                  aria-pressed={planEditMode}
                  className={cn(
                    'rounded p-0.5 hover:bg-slate-200/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-slate-400',
                    planEditMode && 'bg-slate-800 text-white hover:bg-slate-700',
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (planEditMode) cancelPlanEdit();
                    else enterPlanEditMode();
                  }}
                >
                  <Pencil className="h-3.5 w-3.5 shrink-0" aria-hidden />
                </button>
              </WriteOnly>
            </span>
          </SortableDashboardHead>
          {SHOW_OVERDUE_ACCEPTANCE_NOTE_COLUMN ? (
            <DashboardHead width="22%" className="whitespace-normal">
              Ghi chú
            </DashboardHead>
          ) : null}
        </DashboardStickyHeader>
        <DashboardTableBody>
          {rows.map((row) => (
            <DashboardTableRow key={row.contractId}>
              <DashboardTextCell className="align-top">
                <p className="font-mono text-xs font-medium text-slate-900">
                  {row.projectCode}
                </p>
                <p className="mt-0.5 line-clamp-2 text-slate-500">
                  {row.projectName}
                </p>
              </DashboardTextCell>
              <DashboardTextCell className="align-top">
                <Link
                  href={`/contracts/${row.contractId}`}
                  className="text-sm font-medium text-slate-900 underline-offset-2 hover:underline"
                >
                  {row.contractNo}
                </Link>
                <p className="mt-0.5 line-clamp-2 text-slate-500">
                  {row.contractName}
                </p>
              </DashboardTextCell>
              <DashboardMoneyCell className="align-top">
                {planEditMode ? (
                  <PlannedAmountEditor
                    row={row}
                    billingCycle={row.billingCycle}
                    slices={row.revenuePlansInPeriod ?? []}
                    totalFallback={row.plannedAmount}
                    newDraftKey={NEW_PLAN_DRAFT_KEY}
                    drafts={planDrafts[row.contractId]}
                    onChange={updatePlanDraft}
                  />
                ) : (
                  formatCurrencyVND(row.plannedAmount)
                )}
              </DashboardMoneyCell>
              <DashboardMoneyCell className="align-top">
                <AcceptanceByPlanSlice row={row} />
              </DashboardMoneyCell>
              <DashboardMoneyCell>
                {formatCurrencyVND(row.collectedAmount)}
              </DashboardMoneyCell>
              <DashboardMoneyCell
                emphasize={
                  compareDecimalStrings(
                    planEditMode
                      ? gapPlannedMinusActual(
                          plannedDraftTotal(planDrafts[row.contractId]),
                          row.actualAcceptance,
                        )
                      : row.acceptanceGap,
                    '0',
                  ) > 0
                    ? 'amber'
                    : undefined
                }
                className={
                  compareDecimalStrings(
                    planEditMode
                      ? gapPlannedMinusActual(
                          plannedDraftTotal(planDrafts[row.contractId]),
                          row.actualAcceptance,
                        )
                      : row.acceptanceGap,
                    '0',
                  ) < 0
                    ? 'font-medium text-emerald-700'
                    : undefined
                }
              >
                {formatPlanAcceptanceGapVND(
                  planEditMode
                    ? gapPlannedMinusActual(
                        plannedDraftTotal(planDrafts[row.contractId]),
                        row.actualAcceptance,
                      )
                    : row.acceptanceGap,
                )}
              </DashboardMoneyCell>
              <DashboardMoneyCell className="align-top">
                {planEditMode ? (
                  <PlannedAmountEditor
                    row={row}
                    slices={row.revenuePlansInNextPeriod ?? []}
                    totalFallback={row.nextPlannedAmount ?? '0'}
                    newDraftKey={NEW_NEXT_PLAN_DRAFT_KEY}
                    drafts={nextPlanDrafts[row.contractId]}
                    onChange={updateNextPlanDraft}
                    hideSliceLabels
                  />
                ) : (
                  formatCurrencyVND(row.nextPlannedAmount ?? '0')
                )}
              </DashboardMoneyCell>
              {SHOW_OVERDUE_ACCEPTANCE_NOTE_COLUMN ? (
                <DashboardTextCell className="align-top text-[11px] leading-snug text-amber-900">
                  <OverdueAcceptanceNotes
                    notes={row.overdueAcceptanceNotes}
                  />
                </DashboardTextCell>
              ) : null}
            </DashboardTableRow>
          ))}
        </DashboardTableBody>
      </DashboardDataTable>
      </div>
    </div>
  );
}

function formatOverdueBatchLine(note: DashboardKpiOverdueAcceptanceNote) {
  const start = note.periodStartDate
    ? formatDate(note.periodStartDate)
    : '—';
  const end = note.periodEndDate ? formatDate(note.periodEndDate) : '—';
  return `Chưa nghiệm thu đợt ${note.batchSequence} từ ${start} đến ${end} · ${formatCurrencyVND(note.plannedAmount)}`;
}

function OverdueAcceptanceNotes({
  notes,
}: {
  notes?: DashboardKpiOverdueAcceptanceNote[];
}) {
  if (!notes?.length) return <span className="text-slate-400">—</span>;
  return (
    <ul className="list-none space-y-1.5 pl-0">
      {notes.map((note) => (
        <li key={note.batchSequence}>{formatOverdueBatchLine(note)}</li>
      ))}
    </ul>
  );
}

function AcceptanceByPlanSlice({
  row,
}: {
  row: DashboardKpiMonthBreakdown['rows'][number];
}) {
  return (
    <span className="tabular-nums">
      {formatCurrencyVND(row.actualAcceptance)}
    </span>
  );
}

function PlannedAmountEditor({
  row,
  billingCycle,
  slices,
  totalFallback,
  newDraftKey,
  drafts,
  onChange,
  hideSliceLabels = false,
}: {
  row: DashboardKpiMonthBreakdown['rows'][number];
  billingCycle?: BillingCycle;
  slices: DashboardKpiMonthBreakdown['rows'][number]['revenuePlansInPeriod'];
  totalFallback?: string;
  newDraftKey: string;
  drafts: Record<string, string> | undefined;
  onChange: (contractId: string, planKey: string, value: string) => void;
  hideSliceLabels?: boolean;
}) {
  const planSlices = slices ?? [];

  if (planSlices.length === 0) {
    return (
      <MoneyInput
        className="min-w-[8.5rem]"
        value={drafts?.[newDraftKey] ?? ''}
        onChange={(value) => onChange(row.contractId, newDraftKey, value)}
        placeholder="Thêm KH"
      />
    );
  }

  if (planSlices.length === 1) {
    const slice = planSlices[0]!;
    return (
      <MoneyInput
        className="min-w-[8.5rem]"
        value={drafts?.[slice.id] ?? slice.plannedAmount ?? totalFallback ?? ''}
        onChange={(value) => onChange(row.contractId, slice.id, value)}
      />
    );
  }

  return (
    <div className="space-y-1.5">
      {planSlices.map((slice) => (
        <div key={slice.id} className="space-y-0.5">
          {!hideSliceLabels ? (
            <p className="text-[10px] font-medium text-slate-500">
              {planSliceLabel(slice, billingCycle)}
            </p>
          ) : null}
          <MoneyInput
            className="min-w-[8rem]"
            value={drafts?.[slice.id] ?? slice.plannedAmount}
            onChange={(value) => onChange(row.contractId, slice.id, value)}
          />
        </div>
      ))}
    </div>
  );
}
