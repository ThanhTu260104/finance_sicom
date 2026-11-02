'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/auth/auth-provider';
import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { CompanyDashboardTab } from '@/components/dashboard/company/company-dashboard-tab';
import { isSystemAdmin } from '@/lib/api';

function AdminDashboardInner() {
  const searchParams = useSearchParams();

  return (
    <CompanyDashboardTab
      key={searchParams.toString()}
      includeOperatingCost
      sectionTitle="Dashboard quản trị (Admin)"
    />
  );
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const canView = isSystemAdmin(user);

  useEffect(() => {
    if (!loading && !canView) {
      router.replace('/');
    }
  }, [loading, canView, router]);

  if (loading) {
    return <p className="text-sm text-slate-500">Đang kiểm tra quyền…</p>;
  }

  if (!canView) {
    return null;
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: 'Admin', href: '/admin/users' },
          { label: 'Dashboard' },
        ]}
      />
      <div>
        <p className="text-sm font-medium text-slate-500">Admin</p>
        <h1 className="font-serif text-3xl font-semibold text-slate-900">
          Dashboard quản trị
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Giống dashboard công ty, gồm thêm chi phí dự án — chỉ System Admin.
        </p>
      </div>

      <Suspense
        fallback={
          <p className="text-sm text-slate-500">Đang tải dashboard…</p>
        }
      >
        <AdminDashboardInner />
      </Suspense>
    </div>
  );
}
