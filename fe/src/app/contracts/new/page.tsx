'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2 } from 'lucide-react';
import type { Contract } from '@/lib/types';
import { CONTRACT_KINDS } from '@/lib/types';
import { ContractForm } from '@/components/contracts/contract-form';
import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { useAuth } from '@/components/auth/auth-provider';
import { isLimitedUser } from '@/lib/features';
import { contractKindLabel, parseContractKind } from '@/lib/contract-kind';
import { cn } from '@/lib/utils';

function NewContractContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const limited = isLimitedUser(user);
  const kind = parseContractKind(searchParams.get('kind'));
  const projectId = searchParams.get('projectId') ?? undefined;
  // Tài khoản giới hạn không xem được trang chi tiết → ở lại, làm trống form để nhập tiếp
  const [created, setCreated] = useState<Contract[]>([]);
  const [formKey, setFormKey] = useState(0);

  const tabHref = (k: string) => {
    const p = new URLSearchParams();
    if (k !== 'INVESTOR') p.set('kind', k);
    if (projectId) p.set('projectId', projectId);
    const q = p.toString();
    return `/contracts/new${q ? `?${q}` : ''}`;
  };

  return (
    <div className="space-y-4">
      <Breadcrumbs
        items={
          limited
            ? [{ label: 'Thêm hợp đồng' }]
            : [
                { label: 'Quản lý dự án' },
                { label: 'Hợp đồng', href: '/contracts' },
                { label: 'Thêm hợp đồng' },
              ]
        }
      />
      <h2 className="font-serif text-2xl font-semibold">Thêm hợp đồng</h2>

      <div className="flex flex-wrap gap-1 border-b border-slate-200">
        {CONTRACT_KINDS.map((k) => (
          <Link
            key={k}
            href={tabHref(k)}
            replace
            className={cn(
              '-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors',
              kind === k
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-800',
            )}
          >
            {contractKindLabel[k]}
          </Link>
        ))}
      </div>

      {limited && created.length > 0 ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <p className="flex items-center gap-2 font-medium">
            <CheckCircle2 className="h-4 w-4" />
            Đã tạo {created.length} hợp đồng trong phiên này
          </p>
          <ul className="mt-1 list-disc space-y-0.5 pl-6 text-emerald-800">
            {created.map((c) => (
              <li key={c.id}>
                <span className="font-mono font-semibold">{c.contractNo}</span>{' '}
                — {c.name}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <ContractForm
        key={`${kind}-${formKey}`}
        defaultKind={kind}
        defaultProjectId={projectId}
        onSaved={
          limited
            ? (saved) => {
                setCreated((prev) => [saved, ...prev]);
                setFormKey((k) => k + 1);
              }
            : (saved) => {
                router.push(`/contracts/${saved.id}`);
                router.refresh();
              }
        }
        onCancel={limited ? () => setFormKey((k) => k + 1) : undefined}
      />
    </div>
  );
}

export default function NewContractPage() {
  return (
    <Suspense fallback={<div className="p-8 text-slate-500">Đang tải...</div>}>
      <NewContractContent />
    </Suspense>
  );
}
