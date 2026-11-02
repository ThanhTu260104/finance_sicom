'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { acceptancesApi, revenuePlansApi } from '@/lib/api';
import type { Acceptance, Contract, ContractFinanceSummary } from '@/lib/types';
import { ContractKindProvider } from '@/lib/contract-kind';
import { formatCurrencyVND } from '@/lib/format';
import { AcceptancesSection } from '@/components/contracts/acceptances-section';

/**
 * Nghiệm thu trong Nhập nhanh — dùng đúng màn hình nghiệm thu của trang chi tiết HĐ
 * (chọn đợt theo kế hoạch, popup thêm / sửa, đính kèm biên bản…).
 */
export function AcceptancesContractPanel({
  contract,
  refreshSignal,
}: {
  contract: Contract;
  /** Tăng lên để tải lại (vd. sau khi import file kế toán) */
  refreshSignal?: number;
}) {
  const [finance, setFinance] = useState<ContractFinanceSummary | null>(null);
  const [acceptances, setAcceptances] = useState<Acceptance[]>([]);
  // Tăng lên sau khi thêm / sửa / xóa nghiệm thu để tải lại
  const [reloadRev, setReloadRev] = useState(0);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      revenuePlansApi.list(contract.id),
      acceptancesApi.list(contract.id),
    ])
      .then(([financeData, acceptanceData]) => {
        if (cancelled) return;
        setFinance(financeData);
        setAcceptances(acceptanceData);
      })
      .catch((err) => {
        if (!cancelled) {
          toast.error(
            err instanceof Error ? err.message : 'Không tải được nghiệm thu',
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [contract.id, refreshSignal, reloadRev]);

  if (!finance) {
    return (
      <p className="py-6 text-center text-sm text-slate-500">
        Đang tải nghiệm thu của {contract.contractNo}…
      </p>
    );
  }
  return (
    <ContractKindProvider kind={contract.kind}>
      <div className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-3">
          <SummaryTile
            label="Giá trị HĐ"
            value={formatCurrencyVND(finance.contractValue)}
          />
          <SummaryTile
            label="Kế hoạch đã lập"
            value={formatCurrencyVND(finance.totalPlanned)}
          />
          <SummaryTile
            label="Đã nghiệm thu"
            value={formatCurrencyVND(finance.totalAccepted)}
          />
        </div>
        <AcceptancesSection
          contractId={contract.id}
          contractNo={contract.contractNo}
          projectCode={contract.project?.code}
          planRows={finance.comparison}
          contractMeta={{
            durationYears: contract.durationYears,
            billingCycle: contract.billingCycle,
            startDate: contract.startDate,
            endDate: contract.endDate,
          }}
          items={acceptances}
          onChanged={() => setReloadRev((n) => n + 1)}
          hideAccountingImport
        />
      </div>
    </ContractKindProvider>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="font-semibold tabular-nums text-slate-900">{value}</p>
    </div>
  );
}
