'use client';

import { AlertTriangle } from 'lucide-react';
import {
  formatCurrencyVND,
  formatPeriod,
  isNegativeDecimal,
} from '@/lib/format';
import type { ContractFinanceSummary } from '@/lib/types';
import { MoneyKpiCard } from '@/components/dashboard/shared/money-kpi-card';
import { useContractFlowLabels } from '@/lib/contract-kind';
import { cn } from '@/lib/utils';

/**
 * Hàng chỉ số đầu trang chi tiết HĐ. Nhãn theo chiều HĐ:
 * CĐT — mình nghiệm thu & thu tiền; thầu phụ / NCC — đối tác nghiệm thu & mình chi trả.
 */
export function ContractFinanceSummaryPanel({
  finance,
}: {
  finance: ContractFinanceSummary;
}) {
  const flow = useContractFlowLabels();
  const expense = flow.kind !== 'INVESTOR';
  const over =
    finance.overContractValue ||
    finance.remainingAcceptance === 'OVER_CONTRACT_VALUE';
  const scheduleBehind =
    !!finance.scheduleVariance && isNegativeDecimal(finance.scheduleVariance);
  const acceptedRate = Number(finance.acceptanceRatePercent ?? 0);
  const outstanding = Number(finance.outstandingCollection ?? 0);

  const alerts: string[] = [];
  if (over) {
    alerts.push('Đã nghiệm thu vượt giá trị hợp đồng.');
  } else if (scheduleBehind) {
    const gap = formatCurrencyVND(finance.scheduleVariance!.replace(/^-/, ''));
    const period = finance.currentPeriod
      ? ` đến kỳ ${formatPeriod(finance.currentPeriod)}`
      : '';
    alerts.push(
      expense
        ? `${flow.counterpartyRole} chậm so với kế hoạch${period}: thiếu ${gap}.`
        : `Chậm kế hoạch nghiệm thu${period}: thiếu ${gap} — cần đẩy nghiệm thu.`,
    );
  }
  if (!finance.planMatchesContractValue) {
    alerts.push(
      `Tổng kế hoạch (${formatCurrencyVND(finance.totalPlanned)}) chưa khớp giá trị HĐ.`,
    );
  }

  return (
    <div className="space-y-2">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <MoneyKpiCard
          label="Giá trị HĐ"
          value={finance.contractValue}
          sub={`Kế hoạch ${formatCurrencyVND(finance.totalPlanned)}`}
        />
        <MoneyKpiCard
          label={flow.accepted}
          value={finance.totalAccepted}
          sub={`${acceptedRate.toFixed(1)}% giá trị HĐ`}
        />
        <MoneyKpiCard
          label={flow.cashedFull}
          value={finance.totalCollected}
          sub={expense ? 'Tiền mình đã trả đối tác' : 'Tiền CĐT đã trả'}
        />
        <MoneyKpiCard
          label={flow.outstanding}
          value={finance.outstandingCollection}
          sub="Đã nghiệm thu, chưa thanh toán"
          className={cn(outstanding > 0 && 'border-amber-200 bg-amber-50/60')}
        />
        <MoneyKpiCard
          label="Chưa nghiệm thu"
          value={over ? '0' : finance.remainingAcceptance}
          sub={over ? 'Vượt giá trị HĐ' : 'Phần còn lại theo HĐ'}
          className={cn(over && 'border-red-200 bg-red-50/60')}
        />
      </div>
      {alerts.length > 0 ? (
        <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <ul className="space-y-0.5">
            {alerts.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
