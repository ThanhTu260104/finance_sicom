'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';
import { contractsApi } from '@/lib/api';
import type { Contract } from '@/lib/types';
import { ContractForm } from '@/components/contracts/contract-form';
import { QueryState } from '@/components/shared/query-state';
import { Breadcrumbs } from '@/components/layout/breadcrumbs';

export default function EditContractPage() {
  const params = useParams<{ id: string }>();
  const [contract, setContract] = useState<Contract | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await contractsApi.get(params.id);
      setContract(data);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Không tải được hợp đồng';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  return (
    <div className="space-y-4">
      <Breadcrumbs
        items={[
          { label: 'Quản lý dự án' },
          { label: 'Hợp đồng', href: '/contracts' },
          ...(contract
            ? [
                {
                  label: contract.contractNo,
                  href: `/contracts/${contract.id}`,
                },
                { label: 'Sửa' },
              ]
            : [{ label: 'Sửa hợp đồng' }]),
        ]}
      />
      <h2 className="font-serif text-2xl font-semibold">Sửa hợp đồng</h2>
      <QueryState
        loading={loading}
        error={error}
        empty={!contract}
        emptyMessage="Không tìm thấy hợp đồng."
        onRetry={load}
      >
        {contract && (
          <ContractForm contractId={contract.id} initial={contract} />
        )}
      </QueryState>
    </div>
  );
}
