'use client';

import { useMemo, useState } from 'react';
import type {
  DashboardCumulativeTrendPoint,
  DashboardQueryParams,
} from '@/lib/types';
import { CompanyTrendPeriodProjectsPanel } from '@/components/dashboard/company/company-trend-period-projects-panel';
import {
  formatCurrencyVND,
  formatPercentDisplay,
  formatPeriod,
} from '@/lib/format';
import { sumDecimalIntStrings } from '@/lib/decimal-gap';
import { cn } from '@/lib/utils';
import { CollapsibleSection } from '@/components/shared/collapsible-section';
import {
  sortDashboardRows,
  useDashboardTableSort,
} from '@/lib/dashboard-table-sort';
import {
  DashboardDataTable,
  SortableDashboardHead,
  DashboardMoneyCell,
  DashboardStickyHeader,
  DashboardTableBody,
  DashboardTableRow,
  DashboardTextCell,
} from '@/components/dashboard/company/dashboard-data-table-shell';

type TrendTableSortKey =
  | 'period'
  | 'plannedAcceptance'
  | 'actualAcceptance'
  | 'actualWork'
  | 'actualCollection'
  | 'operatingCost'
  | 'acceptanceGapPeriod'
  | 'acceptanceProgressPeriod'
  | 'plannedAcceptanceCumulative'
  | 'actualAcceptanceCumulative'
  | 'actualCollectionCumulative'
  | 'actualWorkCumulative'
  | 'operatingCostCumulative'
  | 'acceptanceGap';

function hasOperatingCostData(rows: DashboardCumulativeTrendPoint[]) {
  return rows.some(
    (r) =>
      Number(r.operatingCost ?? 0) > 0 ||
      Number(r.operatingCostCumulative ?? 0) > 0,
  );
}

export function CompanyCumulativeTrendTable({
  data,
  currentPeriod,
  overviewQuery,
  embedded = false,
  includeOperatingCost = false,
}: {
  data: DashboardCumulativeTrendPoint[];
  currentPeriod?: string;
  overviewQuery: DashboardQueryParams;
  /** Nằm trong khối thu gọn chung — không bọc CollapsibleSection riêng */
  embedded?: boolean;
  includeOperatingCost?: boolean;
}) {
  const [selectedPeriod, setSelectedPeriod] = useState<string | null>(null);
  const { sort, toggleSort } = useDashboardTableSort<TrendTableSortKey>(
    'period',
    false,
  );
  const showCost = useMemo(
    () => includeOperatingCost && hasOperatingCostData(data),
    [data, includeOperatingCost],
  );

  const monthTotals = useMemo(() => {
    if (data.length === 0) return null;
    return {
      planned: sumDecimalIntStrings(data.map((r) => r.plannedAcceptance)),
      actual: sumDecimalIntStrings(data.map((r) => r.actualAcceptance)),
      collected: sumDecimalIntStrings(data.map((r) => r.actualCollection)),
      actualWork: sumDecimalIntStrings(data.map((r) => r.actualWork ?? '0')),
      cost: sumDecimalIntStrings(data.map((r) => r.operatingCost ?? '0')),
      gapPeriod: sumDecimalIntStrings(
        data.map((r) => r.acceptanceGapPeriod ?? '0'),
      ),
    };
  }, [data]);

  const last = data.length > 0 ? data[data.length - 1]! : null;

  const sortedData = useMemo(
    () =>
      sortDashboardRows(
        data,
        sort,
        (row, key) => {
          switch (key) {
            case 'period':
              return row.period;
            case 'plannedAcceptance':
              return row.plannedAcceptance;
            case 'actualAcceptance':
              return row.actualAcceptance;
            case 'actualWork':
              return row.actualWork ?? '0';
            case 'actualCollection':
              return row.actualCollection;
            case 'operatingCost':
              return row.operatingCost ?? '0';
            case 'acceptanceGapPeriod':
              return row.acceptanceGapPeriod ?? '0';
            case 'acceptanceProgressPeriod':
              return row.acceptanceProgressPeriod ?? '0';
            case 'plannedAcceptanceCumulative':
              return row.plannedAcceptanceCumulative;
            case 'actualAcceptanceCumulative':
              return row.actualAcceptanceCumulative;
            case 'actualCollectionCumulative':
              return row.actualCollectionCumulative;
            case 'actualWorkCumulative':
              return row.actualWorkCumulative ?? '0';
            case 'operatingCostCumulative':
              return row.operatingCostCumulative ?? '0';
            case 'acceptanceGap':
              return row.acceptanceGap;
            default:
              return '0';
          }
        },
        (key) => (key === 'period' ? 'period' : 'decimal'),
      ),
    [data, sort],
  );

  if (data.length === 0) {
    const empty = (
      <p className="text-sm text-slate-500">Chưa có dữ liệu theo tháng.</p>
    );
    if (embedded) {
      return (
        <div>
          <p className="mb-2 text-sm font-semibold text-slate-800">
            Bảng chi tiết số liệu biểu đồ
          </p>
          {empty}
        </div>
      );
    }
    return (
      <CollapsibleSection
        title="Bảng chi tiết số liệu biểu đồ"
        description="Theo từng tháng — khớp biểu đồ phía trên"
        defaultOpen={false}
      >
        {empty}
      </CollapsibleSection>
    );
  }

  const minWidth = showCost ? '80rem' : '72rem';

  const tableBlock = (
    <>
      <div className="overflow-hidden rounded-lg border border-slate-200">
        <DashboardDataTable
          minWidth={minWidth}
          maxHeightClass="max-h-[min(32rem,55vh)]"
          footer={
            monthTotals && last ? (
              <DashboardTableBody>
                <DashboardTableRow className="bg-slate-50/90 font-semibold hover:bg-slate-50/90">
                  <DashboardTextCell className="text-slate-800">
                    Tổng / lũy kế cuối kỳ
                  </DashboardTextCell>
                  <DashboardMoneyCell>
                    {formatCurrencyVND(monthTotals.planned)}
                  </DashboardMoneyCell>
                  <DashboardMoneyCell>
                    {formatCurrencyVND(monthTotals.actual)}
                  </DashboardMoneyCell>
                  <DashboardMoneyCell>
                    {formatCurrencyVND(monthTotals.actualWork)}
                  </DashboardMoneyCell>
                  <DashboardMoneyCell>
                    {formatCurrencyVND(monthTotals.collected)}
                  </DashboardMoneyCell>
                  {showCost ? (
                    <DashboardMoneyCell>
                      {formatCurrencyVND(monthTotals.cost)}
                    </DashboardMoneyCell>
                  ) : null}
                  <DashboardMoneyCell emphasize="amber">
                    {formatCurrencyVND(monthTotals.gapPeriod)}
                  </DashboardMoneyCell>
                  <DashboardTextCell>—</DashboardTextCell>
                  <DashboardMoneyCell>
                    {formatCurrencyVND(last.plannedAcceptanceCumulative)}
                  </DashboardMoneyCell>
                  <DashboardMoneyCell>
                    {formatCurrencyVND(last.actualAcceptanceCumulative)}
                  </DashboardMoneyCell>
                  <DashboardMoneyCell>
                    {formatCurrencyVND(last.actualWorkCumulative ?? '0')}
                  </DashboardMoneyCell>
                  <DashboardMoneyCell>
                    {formatCurrencyVND(last.actualCollectionCumulative)}
                  </DashboardMoneyCell>
                  {showCost ? (
                    <DashboardMoneyCell>
                      {formatCurrencyVND(last.operatingCostCumulative ?? '0')}
                    </DashboardMoneyCell>
                  ) : null}
                  <DashboardMoneyCell emphasize="amber">
                    {formatCurrencyVND(last.acceptanceGap)}
                  </DashboardMoneyCell>
                </DashboardTableRow>
              </DashboardTableBody>
            ) : undefined
          }
        >
          <DashboardStickyHeader>
            <SortableDashboardHead
              columnKey="period"
              sortKey={sort.key}
              sortDesc={sort.desc}
              onSort={toggleSort}
              width="7%"
            >
              Tháng
            </SortableDashboardHead>
            <SortableDashboardHead
              columnKey="plannedAcceptance"
              sortKey={sort.key}
              sortDesc={sort.desc}
              onSort={toggleSort}
              align="right"
              width="9%"
            >
              Kế hoạch NT
            </SortableDashboardHead>
            <SortableDashboardHead
              columnKey="actualAcceptance"
              sortKey={sort.key}
              sortDesc={sort.desc}
              onSort={toggleSort}
              align="right"
              width="8%"
            >
              NT thực tế
            </SortableDashboardHead>
            <SortableDashboardHead
              columnKey="actualWork"
              sortKey={sort.key}
              sortDesc={sort.desc}
              onSort={toggleSort}
              align="right"
              width="8%"
            >
              Thực hiện
            </SortableDashboardHead>
            <SortableDashboardHead
              columnKey="actualCollection"
              sortKey={sort.key}
              sortDesc={sort.desc}
              onSort={toggleSort}
              align="right"
              width="9%"
            >
              Thu tiền
            </SortableDashboardHead>
            {showCost ? (
              <SortableDashboardHead
                columnKey="operatingCost"
                sortKey={sort.key}
                sortDesc={sort.desc}
                onSort={toggleSort}
                align="right"
                width="8%"
              >
                Chi phí
              </SortableDashboardHead>
            ) : null}
            <SortableDashboardHead
              columnKey="acceptanceGapPeriod"
              sortKey={sort.key}
              sortDesc={sort.desc}
              onSort={toggleSort}
              align="right"
              width="9%"
            >
              Chênh lệch KH − NT
            </SortableDashboardHead>
            <SortableDashboardHead
              columnKey="acceptanceProgressPeriod"
              sortKey={sort.key}
              sortDesc={sort.desc}
              onSort={toggleSort}
              align="right"
              width="7%"
            >
              Tỷ lệ NT
            </SortableDashboardHead>
            <SortableDashboardHead
              columnKey="plannedAcceptanceCumulative"
              sortKey={sort.key}
              sortDesc={sort.desc}
              onSort={toggleSort}
              align="right"
              width="9%"
            >
              Lũy kế KH NT
            </SortableDashboardHead>
            <SortableDashboardHead
              columnKey="actualAcceptanceCumulative"
              sortKey={sort.key}
              sortDesc={sort.desc}
              onSort={toggleSort}
              align="right"
              width="8%"
            >
              Lũy kế NT
            </SortableDashboardHead>
            <SortableDashboardHead
              columnKey="actualWorkCumulative"
              sortKey={sort.key}
              sortDesc={sort.desc}
              onSort={toggleSort}
              align="right"
              width="8%"
            >
              Lũy kế TH
            </SortableDashboardHead>
            <SortableDashboardHead
              columnKey="actualCollectionCumulative"
              sortKey={sort.key}
              sortDesc={sort.desc}
              onSort={toggleSort}
              align="right"
              width="9%"
            >
              Lũy kế thu
            </SortableDashboardHead>
            {showCost ? (
              <SortableDashboardHead
                columnKey="operatingCostCumulative"
                sortKey={sort.key}
                sortDesc={sort.desc}
                onSort={toggleSort}
                align="right"
                width="8%"
              >
                Lũy kế CP
              </SortableDashboardHead>
            ) : null}
            <SortableDashboardHead
              columnKey="acceptanceGap"
              sortKey={sort.key}
              sortDesc={sort.desc}
              onSort={toggleSort}
              align="right"
              width="9%"
            >
              Lũy kế chênh lệch
            </SortableDashboardHead>
          </DashboardStickyHeader>
          <DashboardTableBody>
            {sortedData.map((row) => {
              const isCurrent = currentPeriod && row.period === currentPeriod;
              const isSelected = selectedPeriod === row.period;
              return (
                <DashboardTableRow
                  key={row.period}
                  onClick={() =>
                    setSelectedPeriod((p) =>
                      p === row.period ? null : row.period,
                    )
                  }
                  className={cn(
                    isCurrent && 'bg-teal-50/40',
                    isSelected && 'ring-2 ring-inset ring-teal-500/50',
                  )}
                  aria-selected={isSelected}
                >
                  <DashboardTextCell className="whitespace-nowrap font-medium tabular-nums">
                    {formatPeriod(row.period)}
                    {isCurrent ? (
                      <span className="ml-1 text-[10px] font-normal text-teal-700">
                        (kỳ hiện tại)
                      </span>
                    ) : null}
                  </DashboardTextCell>
                  <DashboardMoneyCell>
                    {formatCurrencyVND(row.plannedAcceptance)}
                  </DashboardMoneyCell>
                  <DashboardMoneyCell>
                    {formatCurrencyVND(row.actualAcceptance)}
                  </DashboardMoneyCell>
                  <DashboardMoneyCell>
                    {formatCurrencyVND(row.actualWork ?? '0')}
                  </DashboardMoneyCell>
                  <DashboardMoneyCell>
                    {formatCurrencyVND(row.actualCollection)}
                  </DashboardMoneyCell>
                  {showCost ? (
                    <DashboardMoneyCell>
                      {formatCurrencyVND(row.operatingCost ?? '0')}
                    </DashboardMoneyCell>
                  ) : null}
                  <DashboardMoneyCell emphasize="amber">
                    {formatCurrencyVND(row.acceptanceGapPeriod ?? '0')}
                  </DashboardMoneyCell>
                  <DashboardTextCell className="text-right tabular-nums text-slate-700">
                    {formatPercentDisplay(row.acceptanceProgressPeriod)}
                  </DashboardTextCell>
                  <DashboardMoneyCell>
                    {formatCurrencyVND(row.plannedAcceptanceCumulative)}
                  </DashboardMoneyCell>
                  <DashboardMoneyCell>
                    {formatCurrencyVND(row.actualAcceptanceCumulative)}
                  </DashboardMoneyCell>
                  <DashboardMoneyCell>
                    {formatCurrencyVND(row.actualWorkCumulative ?? '0')}
                  </DashboardMoneyCell>
                  <DashboardMoneyCell>
                    {formatCurrencyVND(row.actualCollectionCumulative)}
                  </DashboardMoneyCell>
                  {showCost ? (
                    <DashboardMoneyCell>
                      {formatCurrencyVND(row.operatingCostCumulative ?? '0')}
                    </DashboardMoneyCell>
                  ) : null}
                  <DashboardMoneyCell emphasize="amber">
                    {formatCurrencyVND(row.acceptanceGap)}
                  </DashboardMoneyCell>
                </DashboardTableRow>
              );
            })}
          </DashboardTableBody>
        </DashboardDataTable>
      </div>
      {selectedPeriod ? (
        <div className="mt-3">
          <CompanyTrendPeriodProjectsPanel
            period={selectedPeriod}
            queryParams={overviewQuery}
            showOperatingCost={showCost}
            onClose={() => setSelectedPeriod(null)}
          />
        </div>
      ) : null}
      <p className="mt-2 text-xs text-slate-500">
        Bấm dòng tháng để mở chi tiết dự án. Cột đầu là số trong tháng; các cột
        lũy kế khớp chế độ lũy kế trên biểu đồ.
      </p>
    </>
  );

  if (embedded) {
    return (
      <div>
        <p className="mb-2 text-sm font-semibold text-teal-950">
          Bảng chi tiết số liệu biểu đồ
        </p>
        <p className="mb-3 text-xs text-slate-500">
          Bấm một tháng để xem nghiệm thu · thu tiền theo dự án
        </p>
        {tableBlock}
      </div>
    );
  }

  return (
    <CollapsibleSection
      title="Bảng chi tiết số liệu biểu đồ"
      description="Bấm một tháng để xem nghiệm thu · thu tiền theo dự án (dự án trễ KH được đánh dấu)"
      defaultOpen={false}
    >
      {tableBlock}
    </CollapsibleSection>
  );
}
