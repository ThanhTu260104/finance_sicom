'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Pencil, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import {
  acceptancesApi,
  contractsApi,
  revenuePlansApi,
} from '@/lib/api';
import {
  formatCurrencyVND,
  formatDate,
} from '@/lib/format';
import type {
  Acceptance,
  Contract,
  ContractFinanceSummary,
} from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ContractStatusBadge,
  billingCycleLabel,
  contractTypeLabel,
} from '@/components/shared/status-badges';
import { ConfirmDeleteButton } from '@/components/shared/confirm-delete-button';
import { QueryState } from '@/components/shared/query-state';
import { RevenuePlansSection } from '@/components/contracts/revenue-plans-section';
import { AcceptancesSection } from '@/components/contracts/acceptances-section';
import { ContractFinanceSummaryPanel } from '@/components/contracts/contract-finance-summary-panel';
import { ContractAttachmentsSection } from '@/components/contracts/contract-attachments-section';
import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { cn } from '@/lib/utils';

type TabKey = 'info' | 'plans' | 'acceptances';

function InfoItem({
  label,
  value,
  compactValue,
}: {
  label: string;
  value: ReactNode;
  compactValue?: boolean;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <div
        className={cn(
          'text-slate-900',
          compactValue ? 'text-xs tabular-nums' : 'text-sm',
        )}
      >
        {value || '—'}
      </div>
    </div>
  );
}

export default function ContractDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');
  const [internalTab, setInternalTab] = useState<TabKey>('info');
  const tab: TabKey =
    tabParam === 'plans' || tabParam === 'acceptances' || tabParam === 'info'
      ? tabParam
      : internalTab;
  const [contract, setContract] = useState<Contract | null>(null);
  const [finance, setFinance] = useState<ContractFinanceSummary | null>(null);
  const [acceptances, setAcceptances] = useState<Acceptance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [contractData, financeData, acceptanceData] = await Promise.all([
        contractsApi.get(params.id),
        revenuePlansApi.list(params.id),
        acceptancesApi.list(params.id),
      ]);
      setContract(contractData);
      setFinance(financeData);
      setAcceptances(acceptanceData);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Không tải được hợp đồng';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  const reloadFinance = useCallback(async () => {
    try {
      const [financeData, acceptanceData] = await Promise.all([
        revenuePlansApi.list(params.id),
        acceptancesApi.list(params.id),
      ]);
      setFinance(financeData);
      setAcceptances(acceptanceData);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Không tải lại được');
    }
  }, [params.id]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const handleDelete = async () => {
    try {
      await contractsApi.remove(params.id);
      toast.success('Đã xóa hợp đồng');
      router.push('/contracts');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Xóa thất bại');
    }
  };

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'info', label: 'Thông tin hợp đồng' },
    { key: 'plans', label: 'Kế hoạch nghiệm thu' },
    { key: 'acceptances', label: 'Nghiệm thu' },
  ];

  return (
    <div className="space-y-4">
      <QueryState
        loading={loading}
        error={error}
        empty={!contract || !finance}
        emptyMessage="Không tìm thấy hợp đồng."
        onRetry={load}
      >
        {contract && finance && (
          <>
            <Breadcrumbs
              items={[
                { label: 'Quản lý dự án' },
                { label: 'Hợp đồng', href: '/contracts' },
                { label: contract.contractNo },
              ]}
            />
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <Button asChild variant="ghost" size="sm" className="-ml-2 mb-1">
                  <Link href="/contracts">
                    <ArrowLeft className="h-4 w-4" />
                    Quay lại hợp đồng
                  </Link>
                </Button>
                <p className="text-sm text-slate-500">{contract.contractNo}</p>
                <h2 className="font-serif text-2xl font-semibold">
                  {contract.name}
                </h2>
                {contract.project ? (
                  <p className="mt-1 text-sm text-slate-600">
                    Dự án:{' '}
                    <Link
                      href={`/projects/${contract.project.id}`}
                      className="font-medium text-slate-900 underline-offset-2 hover:underline"
                    >
                      {contract.project.code}
                    </Link>
                  </p>
                ) : null}
                <div className="mt-2">
                  <ContractStatusBadge status={contract.status} />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button asChild>
                  <Link href={`/contracts/${contract.id}/financial-control`}>
                    Quản lý tài chính
                  </Link>
                </Button>
                <Button asChild variant="secondary">
                  <Link href={`/contracts/${contract.id}/edit`}>
                    <Pencil className="h-4 w-4" />
                    Sửa
                  </Link>
                </Button>
                <ConfirmDeleteButton
                  onConfirm={handleDelete}
                  title="Xóa hợp đồng?"
                  description={`Xóa mềm hợp đồng ${contract.contractNo}.`}
                />
              </div>
            </div>

            <ContractFinanceSummaryPanel finance={finance} />

            <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
              {tabs.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setInternalTab(item.key)}
                  className={cn(
                    'rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    tab === item.key
                      ? 'bg-slate-900 text-white'
                      : 'bg-white text-slate-700 hover:bg-slate-100',
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {tab === 'info' && (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Thông tin hợp đồng</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <InfoItem label="Số hợp đồng" value={contract.contractNo} />
                    <InfoItem label="Tên hợp đồng" value={contract.name} />
                    <InfoItem
                      label="Dự án"
                      value={
                        contract.project ? (
                          <Link
                            href={`/projects/${contract.project.id}`}
                            className="text-slate-900 underline-offset-2 hover:underline"
                          >
                            Dự án: {contract.project.code}
                          </Link>
                        ) : (
                          '—'
                        )
                      }
                    />
                    <InfoItem
                      label="Giá trị hợp đồng"
                      value={formatCurrencyVND(contract.contractValue)}
                    />
                    <InfoItem
                      label="Loại hợp đồng"
                      value={contractTypeLabel[contract.contractType]}
                    />
                    <InfoItem
                      label="Chu kỳ nghiệm thu"
                      value={billingCycleLabel[contract.billingCycle]}
                    />
                    <InfoItem
                      label="Hạn thanh toán"
                      value={`${contract.paymentTermDays ?? 0} ngày sau khi nộp hồ sơ`}
                    />
                    <InfoItem
                      label="Ngày ký"
                      compactValue
                      value={formatDate(contract.signedDate)}
                    />
                    <InfoItem
                      label="Ngày bắt đầu"
                      compactValue
                      value={formatDate(contract.startDate)}
                    />
                    <InfoItem
                      label="Ngày kết thúc"
                      compactValue
                      value={formatDate(contract.endDate)}
                    />
                    <InfoItem
                      label="Trạng thái"
                      value={<ContractStatusBadge status={contract.status} />}
                    />
                    <InfoItem label="Ghi chú" value={contract.note} />
                  </CardContent>
                </Card>
                <ContractAttachmentsSection contractId={contract.id} />
              </>
            )}

            {tab === 'plans' && (
              <RevenuePlansSection
                contractId={contract.id}
                finance={finance}
                onChanged={reloadFinance}
              />
            )}

            {tab === 'acceptances' && (
              <AcceptancesSection
                contractId={contract.id}
                items={acceptances}
                onChanged={reloadFinance}
              />
            )}
          </>
        )}
      </QueryState>
    </div>
  );
}
