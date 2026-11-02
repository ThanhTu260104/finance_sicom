'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/app-shell';
import { AuthProvider, useAuth } from '@/components/auth/auth-provider';
import { isPathAllowed, limitedHomeHref } from '@/lib/features';

function AppLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { loading, user } = useAuth();

  const isBareLayout =
    pathname === '/login' || pathname.startsWith('/forms/');
  const isPresentation = pathname === '/presentation';
  const isMonthlyWorkspace = pathname.startsWith(
    '/projects/report-submissions',
  );
  // Tài khoản giới hạn: chỉ trang của tính năng được cấp (API cũng chặn ở BE)
  const allowed = isBareLayout || !user || isPathAllowed(user, pathname);

  useEffect(() => {
    if (!allowed) router.replace(limitedHomeHref(user));
  }, [allowed, router, user]);

  if (isBareLayout) {
    return <>{children}</>;
  }

  if (loading || !user || !allowed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-600">
        Đang tải phiên đăng nhập…
      </div>
    );
  }

  if (isPresentation || isMonthlyWorkspace) {
    return <>{children}</>;
  }

  return <AppShell>{children}</AppShell>;
}

export function AppLayoutClient({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AppLayoutInner>{children}</AppLayoutInner>
    </AuthProvider>
  );
}
