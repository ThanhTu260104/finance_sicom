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
      <CardContent className="space-y-5">
        <section>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Tổng hợp toàn hợp đồng
          </p>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <MetricCard
            label="Giá trị hợp đồng"
            value={formatCurrencyVND(finance.contractValue)}
            large
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
            large
          />
          <MetricCard
            label="Đã nghiệm thu"
            value={formatCurrencyVND(finance.totalAccepted)}
            hint="Chỉ tính đợt đã nộp hồ sơ"
            large
          />
          <MetricCard
            label="Đã thu tiền"
            value={formatCurrencyVND(finance.totalCollected)}
            hint={`Còn phải thu ${formatCurrencyVND(finance.outstandingCollection)}`}
            tone={Number(finance.outstandingCollection) > 0 ? 'warning' : 'success'}
            large
          />
          <MetricCard
            label="Còn phải nghiệm thu"
            value={remainingDisplay(finance.remainingAcceptance, over)}
            hint={`Đã hoàn thành ${formatRate(finance.acceptanceRatePercent)} giá trị HĐ`}
            tone={over ? 'danger' : 'warning'}
            large
          />
          </div>
        </section>

        <section>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Theo kế hoạch đến kỳ {finance.currentPeriod ? formatPeriod(finance.currentPeriod) : 'hiện tại'}
          </p>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Kế hoạch đến kỳ"
              value={formatCurrencyVND(finance.plannedToDate ?? '0')}
              hint={`Kế hoạch riêng kỳ này: ${formatCurrencyVND(finance.monthlyRequiredAcceptance ?? '0')}`}
              large
            />
            <MetricCard
              label="Đã nộp hồ sơ"
              value={formatCurrencyVND(finance.submittedToDate ?? finance.totalAccepted)}
              hint="Lũy kế các đợt đã nộp hồ sơ"
              tone={scheduleRate >= 100 ? 'success' : 'warning'}
              large
            />
            <MetricCard
              label="Chậm trễ: chờ nộp HS"
              value={formatCurrencyVND(finance.pendingSubmissionToDate ?? '0')}
              hint="Đã lên đợt nghiệm thu nhưng chưa nộp hồ sơ"
              tone={Number(finance.pendingSubmissionToDate ?? 0) > 0 ? 'danger' : 'success'}
              large
            />
            <MetricCard
              label="Chậm trễ: chưa đạt KH"
              value={formatCurrencyVND(finance.remainingPlanAfterPending ?? '0')}
              hint={scheduleBehind ? situationLine : 'Đã đủ kế hoạch đến kỳ'}
              tone={scheduleBehind ? 'danger' : 'success'}
              large
            />
          </div>
        </section>
      </CardContent>
    </Card>
  );
}
