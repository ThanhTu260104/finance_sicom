'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, LayoutDashboard, LogOut } from 'lucide-react';
import { APP_LOGO_PATH } from '@/components/brand/app-logo';
import { useAuth } from '@/components/auth/auth-provider';
import { APP_BRAND_MARK, APP_BRAND_NAME } from '@/lib/brand';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export type MonthlyWorkspaceShellProps = {
  title: string;
  subtitle?: string;
  period: string;
  onPeriodChange: (period: string) => void;
  periodLabel?: string;
  backHref?: string;
  backLabel?: string;
  headerExtra?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
};

/** Khung full màn hình theo kỳ tháng — dùng lại cho nộp báo cáo và luồng tháng sau. */
export function MonthlyWorkspaceShell({
  title,
  subtitle,
  period,
  onPeriodChange,
  periodLabel = 'Kỳ báo cáo (tháng)',
  backHref = '/',
  backLabel = 'Về Dashboard',
  headerExtra,
  children,
  className,
}: MonthlyWorkspaceShellProps) {
  const { user, logout } = useAuth();

  return (
    <div
      className={cn(
        'min-h-screen bg-gradient-to-b from-teal-50 to-emerald-50/80',
        className,
      )}
    >
      <div className="border-b border-teal-200/60 bg-white/70 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <Button asChild variant="ghost" size="sm" className="shrink-0">
              <Link href={backHref}>
                <ArrowLeft className="h-4 w-4" />
                {backLabel}
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex">
              <Link href="/projects">
                <LayoutDashboard className="h-4 w-4" />
                Dự án
              </Link>
            </Button>
          </div>
          <div className="flex items-center gap-2">
            {user ? (
              <>
                <span className="hidden max-w-[14rem] truncate text-xs text-slate-600 sm:inline">
                  {user.displayName}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => logout()}
                >
                  <LogOut className="h-4 w-4" />
                  <span className="hidden sm:inline">Thoát</span>
                </Button>
              </>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1400px] space-y-4 px-4 py-6 md:py-8">
        <header className="overflow-hidden rounded-xl border border-teal-800/20 bg-gradient-to-br from-teal-700 via-teal-800 to-emerald-900 shadow-md">
          <div className="flex flex-col gap-4 px-5 py-6 md:flex-row md:items-start md:justify-between md:px-8">
            <div className="flex gap-4">
              <div className="hidden shrink-0 rounded-xl bg-white/95 p-2 shadow-sm ring-1 ring-white/40 sm:block">
                <Image
                  src={APP_LOGO_PATH}
                  alt={APP_BRAND_MARK}
                  width={72}
                  height={72}
                  className="h-[4.5rem] w-[4.5rem] rounded-lg object-contain"
                  priority
                />
              </div>
              <div className="min-w-0 text-white">
                <h1 className="text-xl font-semibold tracking-tight md:text-2xl">
                  {title}
                </h1>
                {subtitle ? (
                  <p className="mt-2 max-w-2xl text-sm leading-relaxed text-teal-100/95">
                    {subtitle}
                  </p>
                ) : null}
              </div>
            </div>
            <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-end">
              <div>
                <Label
                  htmlFor="monthly-workspace-period"
                  className="text-xs text-teal-100/90"
                >
                  {periodLabel}
                </Label>
                <Input
                  id="monthly-workspace-period"
                  type="month"
                  value={period}
                  onChange={(e) => onPeriodChange(e.target.value)}
                  className="mt-1 w-[11rem] border-white/20 bg-white/95"
                />
              </div>
              {headerExtra}
            </div>
          </div>
        </header>

        {children}

        <p className="pb-4 text-center text-xs text-teal-800/70">
          {APP_BRAND_NAME} · Workspace theo tháng
        </p>
      </div>
    </div>
  );
}
