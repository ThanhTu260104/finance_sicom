'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';
import { CONTRACT_KINDS } from '@/lib/types';
import {
  contractKindLabel,
  contractListHref,
  parseContractKind,
} from '@/lib/contract-kind';

/**
 * 3 tab danh sách HĐ (CĐT / thầu phụ / NCC) — chỉ ở trang danh sách và trang thêm HĐ.
 * Thống kê và Bảo trì theo ngày nằm ở sidebar (nhóm Khác).
 */
export function ContractSubNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (pathname !== '/contracts' && pathname !== '/contracts/new') return null;

  const active =
    pathname === '/contracts'
      ? `list-${parseContractKind(searchParams.get('kind'))}`
      : null;

  return (
    <nav className="mb-4 flex flex-wrap gap-2 rounded-lg border border-slate-200 bg-white/90 p-2">
      <span className="self-center px-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Hợp đồng
      </span>
      {CONTRACT_KINDS.map((kind) => (
        <Link
          key={kind}
          href={contractListHref(kind)}
          className={cn(
            'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
            active === `list-${kind}`
              ? 'bg-slate-900 text-white'
              : 'text-slate-700 hover:bg-slate-100',
          )}
        >
          {contractKindLabel[kind]}
        </Link>
      ))}
    </nav>
  );
}
