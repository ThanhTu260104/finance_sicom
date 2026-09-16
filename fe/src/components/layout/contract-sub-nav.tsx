'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type TabKey = 'info' | 'plans' | 'acceptances' | 'financial';

function getContractId(pathname: string) {
  const match = pathname.match(/^\/contracts\/([^/]+)/);
  const id = match?.[1];
  if (!id || id === 'new' || !UUID_RE.test(id)) return null;
  return id;
}

export function ContractSubNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (!pathname.startsWith('/contracts')) return null;

  const contractId = getContractId(pathname);
  const tabParam = searchParams.get('tab');
  const active: TabKey | 'list' =
    contractId && pathname.endsWith('/financial-control')
      ? 'financial'
      :
    contractId &&
    (tabParam === 'plans' || tabParam === 'acceptances' || tabParam === 'info')
      ? tabParam
      : contractId
        ? 'info'
        : 'list';

  const items: { key: string; label: string; href: string }[] = [
    { key: 'list', label: 'Danh sách hợp đồng', href: '/contracts' },
  ];

  if (contractId) {
    items.push(
      {
        key: 'info',
        label: 'Thông tin HĐ',
        href: `/contracts/${contractId}?tab=info`,
      },
      {
        key: 'plans',
        label: 'Kế hoạch nghiệm thu',
        href: `/contracts/${contractId}?tab=plans`,
      },
      {
        key: 'acceptances',
        label: 'Nghiệm thu',
        href: `/contracts/${contractId}?tab=acceptances`,
      },
      {
        key: 'financial',
        label: 'Quản lý tài chính',
        href: `/contracts/${contractId}/financial-control`,
      },
    );
  }

  return (
    <nav className="mb-4 flex flex-wrap gap-2 rounded-lg border border-slate-200 bg-white/90 p-2">
      <span className="self-center px-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Tài chính
      </span>
      {items.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          className={cn(
            'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
            active === item.key
              ? 'bg-slate-900 text-white'
              : 'text-slate-700 hover:bg-slate-100',
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
