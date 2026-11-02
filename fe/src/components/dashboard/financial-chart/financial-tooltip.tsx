'use client';

import {
  formatCurrencyVND,
  formatPercentDisplay,
  formatPeriod,
} from '@/lib/format';

export type FinancialTooltipPayload = {
  title?: string;
  month?: string;
  project?: string;
  contract?: string;
  totalContractValue?: string;
  plannedAcceptance?: string;
  actualAcceptance?: string;
  actualWork?: string;
  acceptanceGap?: string;
  actualCollection?: string;
  operatingCost?: string;
  acceptanceProgress?: string;
  collectionProgress?: string;
  acceptanceProgressPeriod?: string;
};

export function FinancialTooltip({
  data,
  variant = 'panel',
}: {
  data: FinancialTooltipPayload;
  variant?: 'panel' | 'floating';
}) {
  const rows: Array<{ label: string; value: string }> = [];

  if (data.totalContractValue) {
    rows.push({
      label: 'Giá trị hợp đồng',
      value: formatCurrencyVND(data.totalContractValue),
    });
  }
  if (data.plannedAcceptance) {
    rows.push({
      label: 'Kế hoạch nghiệm thu',
      value: formatCurrencyVND(data.plannedAcceptance),
    });
  }
  if (data.actualAcceptance) {
    rows.push({
      label: 'Nghiệm thu thực tế',
      value: formatCurrencyVND(data.actualAcceptance),
    });
  }
  if (data.actualWork) {
    rows.push({
      label: 'Thực hiện',
      value: formatCurrencyVND(data.actualWork),
    });
  }
  if (data.acceptanceGap) {
    rows.push({
      label: 'Chênh lệch',
      value: formatCurrencyVND(data.acceptanceGap),
    });
  }
  if (data.acceptanceProgressPeriod) {
    rows.push({
      label: 'Tỷ lệ NT tháng',
      value: formatPercentDisplay(data.acceptanceProgressPeriod),
    });
  }
  if (data.acceptanceProgress) {
    rows.push({
      label: 'Tiến độ nghiệm thu',
      value: formatPercentDisplay(data.acceptanceProgress),
    });
  }
  if (data.actualCollection) {
    rows.push({
      label: 'Thu thực tế',
      value: formatCurrencyVND(data.actualCollection),
    });
  }
  if (
    data.operatingCost &&
    data.operatingCost !== '0' &&
    Number(data.operatingCost) > 0
  ) {
    rows.push({
      label: 'Chi phí',
      value: formatCurrencyVND(data.operatingCost),
    });
  }
  if (data.collectionProgress) {
    rows.push({
      label: 'Tỷ lệ thu',
      value: formatPercentDisplay(data.collectionProgress),
    });
  }

  const heading =
    data.title ??
    (data.month ? formatPeriod(data.month) : undefined) ??
    data.project ??
    data.contract ??
    'Chi tiết';

  const shell =
    variant === 'floating'
      ? 'rounded-lg border border-slate-300 bg-white/95 px-3 py-2 shadow-lg backdrop-blur-sm'
      : 'rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-md';

  return (
    <div className={shell}>
      <p
        className={
          variant === 'floating'
            ? 'text-xs font-semibold text-slate-900'
            : 'text-sm font-semibold text-slate-900'
        }
      >
        {heading}
      </p>
      {data.project && data.title ? (
        <p className="text-xs text-slate-600">{data.project}</p>
      ) : null}
      {data.contract && data.title ? (
        <p className="text-xs text-slate-600">{data.contract}</p>
      ) : null}
      <dl className={variant === 'floating' ? 'mt-1.5 space-y-1' : 'mt-2 space-y-1.5'}>
        {rows.map((row) => (
          <div
            key={row.label}
            className={
              variant === 'floating'
                ? 'flex justify-between gap-3 text-[11px]'
                : 'flex justify-between gap-6 text-sm'
            }
          >
            <dt className="text-slate-600">{row.label}</dt>
            <dd className="font-medium tabular-nums text-slate-900">{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
