'use client';

import Link from 'next/link';
import { Suspense, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { Presentation } from 'lucide-react';
import { CompanyDashboardTab } from '@/components/dashboard/company/company-dashboard-tab';
import { Button } from '@/components/ui/button';
import { parseDashboardQuery } from '@/lib/dashboard-filters-url';
import { presentationUrlToSearchParams } from '@/lib/presentation-url';
import { currentCalendarPeriod } from '@/lib/period';

function DashboardHomeInner() {
  const searchParams = useSearchParams();
  const presentationHref = useMemo(() => {
    const query = parseDashboardQuery(searchParams);
    const period =
      query.kpiPeriod?.trim() ||
      query.projectPeriod?.trim() ||
      currentCalendarPeriod();
    const p = presentationUrlToSearchParams({
      step: 1,
      query: { ...query, kpiPeriod: period, projectPeriod: period },
      projectId: query.explorerProjectId,
      contractId: query.explorerContractId,
    });
    return `/presentation?${p.toString()}`;
  }, [searchParams]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">Dashboard</p>
          <h1 className="font-serif text-3xl font-semibold text-slate-900">
            Quản trị tài chính SICOM
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Doanh thu · nghiệm thu · thu tiền (không hiển thị chi phí dự án)
          </p>
        </div>
        <Button asChild variant="default" size="sm" className="shrink-0">
          <Link href={presentationHref}>
            <Presentation className="mr-2 h-4 w-4" />
            Trình chiếu
          </Link>
        </Button>
      </div>

      <CompanyDashboardTab
        key={searchParams.toString()}
        includeOperatingCost={false}
      />
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <p className="text-sm text-slate-500">Đang tải dashboard…</p>
      }
    >
      <DashboardHomeInner />
    </Suspense>
  );
}
