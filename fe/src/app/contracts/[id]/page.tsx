'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Pencil, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import {
  acceptancesApi,
  contractsApi,
  revenuePlansApi,
} from '@/lib/api';
import type {
  Acceptance,
  Contract,
  ContractFinanceSummary,
  ContractKind,
} from '@/lib/types';
import {
  ContractKindProvider,
  contractFlowLabels,
  contractKindLabel,
  contractListHref,
  isExpenseContractKind,
} from '@/lib/contract-kind';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ContractStatusBadge } from '@/components/shared/status-badges';
import { ConfirmDeleteButton } from '@/components/shared/confirm-delete-button';
import { ContractInfoTable } from '@/components/contracts/contract-info-table';
import { QueryState } from '@/components/shared/query-state';
import { RevenuePlansSection } from '@/components/contracts/revenue-plans-section';
import { AcceptancesSection } from '@/components/contracts/acceptances-section';
import { ContractFormDialog } from '@/components/contracts/contract-form-dialog';
import { ContractFinanceSummaryPanel } from '@/components/contracts/contract-finance-summary-panel';
import { ContractAttachmentsSection } from '@/components/contracts/contract-attachments-section';
import { ContractExpiryBadge } from '@/components/contracts/contract-expiry-highlight';
import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { ContractContextBar } from '@/components/contracts/contract-context-bar';
import { cn } from '@/lib/utils';
import { WriteOnly } from '@/components/auth/auth-provider';

// Thu / chi tiền ghi ngay ở Nghiệm thu (chọn "Đã thu" / "Đã chi trả" → tự tạo bản ghi)
type TabKey = 'info' | 'plans' | 'acceptances';

const TAB_KEYS: TabKey[] = ['info', 'plans', 'acceptances'];

function parseTab(value: string | null): TabKey {
  return (TAB_KEYS as string[]).includes(value ?? '')
    ? (value as TabKey)
    : 'info';
}

export default function ContractDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  // Tab nằm trên URL (?tab=) — link từ trang khác / F5 giữ đúng tab
  const tab = parseTab(searchParams.get('tab'));
  const [contract, setContract] = useState<Contract | null>(null);
  const [finance, setFinance] = useState<ContractFinanceSummary | null>(null);
  const [acceptances, setAcceptances] = useState<Acceptance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);

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

  const kind: ContractKind = contract?.kind ?? 'INVESTOR';
  const expense = isExpenseContractKind(kind);
  const flow = contractFlowLabels(kind);

  const handleDelete = async () => {
    try {
      await contractsApi.remove(params.id);
      toast.success('Đã xóa hợp đồng');
      router.push(contractListHref(kind));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Xóa thất bại');
    }
  };

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'info', label: 'Thông tin' },
    { key: 'plans', label: flow.planTitle },
    { key: 'acceptances', label: flow.acceptanceTitle },
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
          <ContractKindProvider kind={contract.kind}>
            <Breadcrumbs
              items={[
                { label: 'Quản lý dự án' },
                {
                  label: contractKindLabel[kind],
                  href: contractListHref(kind),
                },
                { label: contract.contractNo },
              ]}
            />
            <ContractContextBar
              projectCode={contract.project?.code}
              projectName={contract.project?.name ?? contract.project?.code}
              projectId={contract.project?.id}
              contractNo={contract.contractNo}
              contractName={contract.name}
              className="-mx-1 mb-2 rounded-md px-1"
            />

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <Button asChild variant="ghost" size="sm" className="-ml-2">
                  <Link href={contractListHref(kind)}>
                    <ArrowLeft className="h-4 w-4" />
                    {contractKindLabel[kind]}
                  </Link>
                </Button>
                <Badge variant={expense ? 'warning' : 'muted'}>
                  {expense
                    ? `${flow.counterpartyRole}: ${contract.counterparty?.code ?? '—'}`
                    : 'Thu tiền CĐT'}
                </Badge>
                <ContractStatusBadge status={contract.status} />
                <ContractExpiryBadge
                  endDate={contract.endDate}
                  status={contract.status}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {/* Theo dõi tháng & dashboard hiện dành cho HĐ thu (CĐT) */}
                {!expense ? (
                  <>
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/contracts/${contract.id}/financial-control`}>
                        Theo dõi theo tháng
                      </Link>
                    </Button>
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/contracts/${contract.id}/dashboard`}>
                        Dashboard
                      </Link>
                    </Button>
                  </>
                ) : null}
                <WriteOnly>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setEditOpen(true)}
                  >
                    <Pencil className="h-4 w-4" />
                    Sửa
                  </Button>
                </WriteOnly>
                <ConfirmDeleteButton
                  onConfirm={handleDelete}
                  title="Xóa hợp đồng?"
                  description={`Xóa mềm hợp đồng ${contract.contractNo}.`}
                />
              </div>
            </div>

            <ContractFinanceSummaryPanel finance={finance} />

            <nav className="flex flex-wrap gap-1 border-b border-slate-200">
              {tabs.map((item) => (
                <Link
                  key={item.key}
                  href={`/contracts/${contract.id}?tab=${item.key}`}
                  replace
                  scroll={false}
                  className={cn(
                    '-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors',
                    tab === item.key
                      ? 'border-slate-900 text-slate-900'
                      : 'border-transparent text-slate-500 hover:text-slate-800',
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            {tab === 'info' && (
              <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Thông tin hợp đồng</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ContractInfoTable contract={contract} />
                  </CardContent>
                </Card>
                <ContractAttachmentsSection contractId={contract.id} />
              </div>
            )}

            {tab === 'plans' && (
              <RevenuePlansSection
                contractId={contract.id}
                finance={finance}
                contractMeta={{
                  contractValue: contract.contractValue,
                  durationYears: contract.durationYears,
                  billingCycle: contract.billingCycle,
                  startDate: contract.startDate,
                  endDate: contract.endDate,
                }}
                onChanged={reloadFinance}
              />
            )}

            {tab === 'acceptances' && (
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
                onChanged={reloadFinance}
              />
            )}

            <ContractFormDialog
              open={editOpen}
              onOpenChange={setEditOpen}
              contract={contract}
              onSaved={(saved) => {
                setContract((prev) => (prev ? { ...prev, ...saved } : saved));
                void reloadFinance();
              }}
            />
          </ContractKindProvider>
        )}
      </QueryState>
    </div>
  );
}
