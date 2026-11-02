'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ExternalLink } from 'lucide-react';
import type { Contract } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/components/auth/auth-provider';
import {
  ContractPicker,
  readStoredContractId,
  storeContractId,
} from '@/components/quick-entry/contract-picker';
import { AccountingAcceptanceImport } from '@/components/quick-entry/accounting-acceptance-import';
import { AcceptancesBulkExport } from '@/components/quick-entry/acceptances-bulk-export';
import { CollapsibleSection } from '@/components/shared/collapsible-section';
import { AcceptancesContractPanel } from '@/components/quick-entry/acceptances-contract-panel';

const MAIN_VIEWS = [
  { key: 'entry', label: 'Nhập nghiệm thu' },
  { key: 'export', label: 'Xuất nhanh' },
] as const;

type MainViewKey = (typeof MAIN_VIEWS)[number]['key'];

export function QuickEntryView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const viewParam = searchParams.get('view');
  const contractParam = searchParams.get('contract');

  // HĐ đang nhập nằm trên URL (?contract=) — F5 / chia sẻ link giữ đúng HĐ
  const contractId = contractParam ?? '';
  const [contract, setContract] = useState<Contract | null>(null);
  const [acceptanceImportRev, setAcceptanceImportRev] = useState(0);
  // Import file kế toán chỉ cho quản trị (BE cũng chặn)
  const isAdmin = useAuth().user?.role === 'ADMIN';

  const mainView: MainViewKey = viewParam === 'export' ? 'export' : 'entry';

  const syncUrl = useCallback(
    (nextView: MainViewKey, nextContract: string) => {
      const params = new URLSearchParams();
      if (nextView === 'export') params.set('view', 'export');
      else if (nextContract) params.set('contract', nextContract);
      const q = params.toString();
      router.replace(q ? `/quick-entry?${q}` : '/quick-entry', {
        scroll: false,
      });
    },
    [router],
  );

  // Không có HĐ trên URL → mở lại HĐ nhập lần trước trong phiên
  useEffect(() => {
    if (contractParam || viewParam === 'export') return;
    const stored = readStoredContractId();
    if (stored) syncUrl('entry', stored);
  }, [contractParam, viewParam, syncUrl]);

  const handleContractChange = (id: string) => {
    storeContractId(id);
    syncUrl('entry', id);
  };

  const handleContractLoaded = useCallback((c: Contract | null) => {
    setContract(c);
  }, []);

  return (
    <div className="w-full space-y-5 p-4 md:p-6">
      <Breadcrumbs
        items={[
          { label: 'Nhập nhanh', href: '/quick-entry' },
          ...(mainView === 'export' ? [{ label: 'Xuất nhanh' }] : []),
        ]}
      />
      <div>
        <h1 className="font-serif text-2xl font-semibold text-slate-900">
          {mainView === 'export' ? 'Xuất nhanh' : 'Nhập nghiệm thu nhanh'}
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">
          {mainView === 'export'
            ? 'Xuất dữ liệu nghiệm thu gộp toàn bộ hợp đồng ra Excel.'
            : 'Chọn dự án → chọn hợp đồng, rồi thêm / sửa nghiệm thu ngay tại đây.'}
        </p>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
        {MAIN_VIEWS.map((v) => (
          <button
            key={v.key}
            type="button"
            onClick={() => syncUrl(v.key, contractId)}
            className={cn(
              'rounded-md px-4 py-2 text-sm font-medium transition-colors',
              mainView === v.key
                ? 'bg-slate-900 text-white'
                : 'text-slate-700 hover:bg-slate-100',
            )}
          >
            {v.label}
          </button>
        ))}
      </div>

      {mainView === 'export' ? (
        <AcceptancesBulkExport />
      ) : (
        <>
          {isAdmin ? (
            <CollapsibleSection
              title="Import file kế toán"
              description="Nhập hàng loạt nghiệm thu nhiều HĐ từ bảng của kế toán."
              defaultOpen={false}
            >
              <AccountingAcceptanceImport
                highlightContractNo={contract?.contractNo}
                onImported={() => setAcceptanceImportRev((n) => n + 1)}
              />
            </CollapsibleSection>
          ) : null}

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
              <CardTitle className="text-base">Chọn dự án &amp; hợp đồng</CardTitle>
              {contractId ? (
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/contracts/${contractId}`}>
                    <ExternalLink className="mr-1.5 h-4 w-4" />
                    Mở trang HĐ
                  </Link>
                </Button>
              ) : null}
            </CardHeader>
            <CardContent className="space-y-2">
              <ContractPicker
                value={contractId}
                onChange={handleContractChange}
                onContractLoaded={handleContractLoaded}
              />
            </CardContent>
          </Card>

          {contract ? (
            <AcceptancesContractPanel
              key={contract.id}
              contract={contract}
              refreshSignal={acceptanceImportRev}
            />
          ) : (
            <p className="rounded-lg border border-dashed border-slate-300 py-8 text-center text-sm text-slate-500">
              Chọn dự án rồi chọn hợp đồng ở trên để nhập nghiệm thu.
            </p>
          )}
        </>
      )}
    </div>
  );
}
