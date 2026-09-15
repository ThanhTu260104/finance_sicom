'use client';

import {
  formatCurrencyVND,
  formatPeriod,
  isNegativeDecimal,
} from '@/lib/format';
import type { ContractFinanceSummary } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

function MetricCard({
  label,
  value,
  hint,
  tone,
  large,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: 'danger' | 'success' | 'warning' | 'default';
  large?: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-lg border border-slate-200 bg-white p-4',
        tone === 'danger' && 'border-red-200 bg-red-50/60',
        tone === 'success' && 'border-emerald-200 bg-emerald-50/50',
        tone === 'warning' && 'border-amber-200 bg-amber-50/60',
      )}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <div
        className={cn(
          'mt-1 font-semibold text-slate-900',
          large ? 'text-2xl' : 'text-lg',
          tone === 'danger' && 'text-red-700',
          tone === 'success' && 'text-emerald-800',
          tone === 'warning' && 'text-amber-800',
        )}
      >
        {value}
      </div>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

function formatRate(value?: string) {
  if (!value) return '0%';
  return `${value}%`;
}

function remainingDisplay(value: string, over?: boolean) {
  if (over || value === 'OVER_CONTRACT_VALUE') {
    return 'Vượt giá trị HĐ';
  }
  return formatCurrencyVND(value);
}

export function ContractFinanceSummaryPanel({
  finance,
}: {
  finance: ContractFinanceSummary;
}) {
  const over =
    finance.overContractValue ||
    finance.remainingAcceptance === 'OVER_CONTRACT_VALUE';
  const scheduleBehind =
    !!finance.scheduleVariance && isNegativeDecimal(finance.scheduleVariance);
  const acceptedRate = Number(finance.acceptanceRatePercent ?? 0);
  const scheduleRate = Number(finance.scheduleRatePercent ?? 0);

  const situationLine = over
    ? 'Cảnh báo: đã nghiệm thu vượt giá trị hợp đồng.'
    : scheduleBehind
      ? `Chậm kế hoạch lũy kế ${formatCurrencyVND(
          finance.scheduleVariance?.replace(/^-/, '') ?? '0',
        )} — cần đẩy nghiệm thu.`
      : acceptedRate >= 100
        ? 'Đã nghiệm thu đủ giá trị hợp đồng.'
        : `Còn ${remainingDisplay(finance.remainingAcceptance, over)} chưa nghiệm thu (${(100 - acceptedRate).toFixed(1)}% HĐ).`;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Tóm tắt tài chính</CardTitle>
        <p className="text-sm text-slate-600">{situationLine}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Giá trị phải NT tháng này"
            value={formatCurrencyVND(finance.monthlyRequiredAcceptance ?? '0')}
            hint={
              finance.currentPeriod
                ? `Kỳ ${formatPeriod(finance.currentPeriod)} · TB tháng ${formatCurrencyVND(finance.averageMonthlyPlanned ?? '0')}`
                : undefined
            }
            large
          />
          <MetricCard
            label="Tỉ lệ đã nghiệm thu"
            value={formatRate(finance.acceptanceRatePercent)}
            hint={`${formatCurrencyVND(finance.totalAccepted)} / ${formatCurrencyVND(finance.contractValue)}`}
            tone={
              over
                ? 'danger'
                : acceptedRate >= 80
                  ? 'success'
                  : acceptedRate >= 40
                    ? 'warning'
                    : 'default'
            }
            large
          />
          <MetricCard
            label="Số tiền chưa nghiệm thu"
            value={remainingDisplay(finance.remainingAcceptance, over)}
            hint="Giá trị HĐ − đã nghiệm thu (đã nộp hồ sơ)"
            tone={over ? 'danger' : 'warning'}
            large
          />
          <MetricCard
            label="Tiến độ so với kế hoạch"
            value={formatRate(finance.scheduleRatePercent)}
            hint={
              finance.plannedToDate
                ? `Đã NT / KH đến ${formatPeriod(finance.currentPeriod ?? '')}: ${formatCurrencyVND(finance.totalAccepted)} / ${formatCurrencyVND(finance.plannedToDate)}`
                : undefined
            }
            tone={
              scheduleBehind
                ? 'danger'
                : scheduleRate >= 100
                  ? 'success'
                  : 'warning'
            }
            large
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <MetricCard
            label="Giá trị hợp đồng"
            value={formatCurrencyVND(finance.contractValue)}
          />
          <MetricCard
            label="Tổng kế hoạch nghiệm thu"
            value={formatCurrencyVND(finance.totalPlanned)}
            hint={
              finance.planMatchesContractValue
                ? 'KH khớp giá trị HĐ'
                : 'KH chưa khớp giá trị HĐ'
            }
            tone={finance.planMatchesContractValue ? 'success' : 'warning'}
          />
          <MetricCard
            label="Đã nghiệm thu"
            value={formatCurrencyVND(finance.totalAccepted)}
            hint="Chỉ tính đợt đã nộp hồ sơ"
          />
        </div>

        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className={cn(
              'h-full rounded-full transition-all',
              over ? 'bg-red-500' : 'bg-slate-900',
            )}
            style={{
              width: `${Math.min(Math.max(acceptedRate, 0), 100)}%`,
            }}
          />
        </div>
      </CardContent>
    </Card>
  );
}
