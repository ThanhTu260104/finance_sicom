'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  FileText,
  FolderKanban,
  LayoutDashboard,
  Menu,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ContractSubNav } from '@/components/layout/contract-sub-nav';

type NavLink = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  match?: (pathname: string) => boolean;
};

type NavSection = {
  title?: string;
  items: NavLink[];
};

const SIDEBAR_STORAGE_KEY = 'finance-sidebar-collapsed';

const navSections: NavSection[] = [
  {
    items: [
      {
        href: '/',
        label: 'Dashboard',
        icon: LayoutDashboard,
        match: (pathname) => pathname === '/',
      },
    ],
  },
  {
    title: 'QUẢN LÝ DỰ ÁN',
    items: [
      {
        href: '/projects',
        label: 'Dự án',
        icon: FolderKanban,
        match: (pathname) => pathname.startsWith('/projects'),
      },
      {
        href: '/customers',
        label: 'Khách hàng',
        icon: Building2,
        match: (pathname) => pathname.startsWith('/customers'),
      },
      {
        href: '/contracts',
        label: 'Hợp đồng',
        icon: FileText,
        match: (pathname) => pathname.startsWith('/contracts'),
      },
    ],
  },
];

function isActive(item: NavLink, pathname: string) {
  if (item.match) return item.match(pathname);
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function SidebarNav({
  pathname,
  collapsed,
  onNavigate,
}: {
  pathname: string;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <nav
      className={cn(
        'flex flex-1 flex-col gap-6 overflow-y-auto py-4',
        collapsed ? 'px-2' : 'px-3',
      )}
    >
      {navSections.map((section, sectionIndex) => (
        <div key={section.title ?? `section-${sectionIndex}`} className="space-y-1">
          {section.title && !collapsed ? (
            <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              {section.title}
            </p>
          ) : null}
          {section.items.map((item) => {
            const active = isActive(item, pathname);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                title={collapsed ? item.label : undefined}
                className={cn(
                  'flex items-center rounded-md text-sm font-medium transition-colors',
                  collapsed
                    ? 'justify-center px-2 py-2.5'
                    : 'gap-2.5 px-3 py-2',
                  active
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-700 hover:bg-slate-100',
                )}
                aria-current={active ? 'page' : undefined}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {!collapsed ? <span>{item.label}</span> : null}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const stored = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);
        if (stored === '1') setCollapsed(true);
      } catch {
        // ignore storage access errors
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileOpen]);

  const toggleCollapsed = () => {
    setCollapsed((value) => {
      const next = !value;
      try {
        window.localStorage.setItem(SIDEBAR_STORAGE_KEY, next ? '1' : '0');
      } catch {
        // ignore storage access errors
      }
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#e8eef7,_#f8fafc_45%,_#eef2f7)]">
      <div className="flex min-h-screen w-full">
        <aside
          className={cn(
            'sticky top-0 hidden h-screen shrink-0 flex-col border-r border-slate-200/80 bg-white/90 backdrop-blur transition-[width] duration-200 md:flex',
            collapsed ? 'w-[4.25rem]' : 'w-64',
          )}
        >
          <div
            className={cn(
              'border-b border-slate-200/80 py-4',
              collapsed ? 'px-2' : 'px-4',
            )}
          >
            {!collapsed ? (
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Finance Project
                </p>
                <p className="mt-1 font-serif text-lg font-semibold tracking-tight text-slate-900">
                  Quản lý dự án
                </p>
              </div>
            ) : (
              <p className="text-center font-serif text-sm font-semibold text-slate-900">
                FP
              </p>
            )}
          </div>
          <SidebarNav pathname={pathname} collapsed={collapsed} />
          <div className="border-t border-slate-200/80 p-2">
            <Button
              type="button"
              variant="ghost"
              size={collapsed ? 'icon' : 'sm'}
              className={cn('w-full', !collapsed && 'justify-start')}
              onClick={toggleCollapsed}
              aria-label={collapsed ? 'Mở rộng menu' : 'Thu gọn menu'}
            >
              {collapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <>
                  <ChevronLeft className="h-4 w-4" />
                  Thu gọn
                </>
              )}
            </Button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-slate-200/80 bg-white/85 px-3 py-3 backdrop-blur sm:px-4 lg:px-5">
            <div className="flex min-w-0 items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="md:hidden"
                aria-label="Mở menu"
                onClick={() => setMobileOpen(true)}
              >
                <Menu className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="hidden md:inline-flex"
                aria-label={collapsed ? 'Mở rộng menu' : 'Thu gọn menu'}
                onClick={toggleCollapsed}
              >
                {collapsed ? (
                  <ChevronRight className="h-4 w-4" />
                ) : (
                  <ChevronLeft className="h-4 w-4" />
                )}
              </Button>
              <div className="min-w-0 md:hidden">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Finance Project
                </p>
                <p className="truncate font-serif text-base font-semibold text-slate-900">
                  Quản lý dự án
                </p>
              </div>
              <div className="hidden min-w-0 md:block">
                <h1 className="font-serif text-xl font-semibold tracking-tight text-slate-900">
                  Quản lý dự án &amp; nghiệm thu
                </h1>
              </div>
            </div>
          </header>

          {mobileOpen ? (
            <div className="fixed inset-0 z-50 md:hidden">
              <button
                type="button"
                className="absolute inset-0 bg-slate-900/40"
                aria-label="Đóng menu"
                onClick={() => setMobileOpen(false)}
              />
              <aside className="absolute inset-y-0 left-0 flex w-[min(18rem,88vw)] flex-col bg-white shadow-xl">
                <div className="flex items-start justify-between border-b border-slate-200 px-4 py-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                      Finance Project
                    </p>
                    <p className="mt-1 font-serif text-lg font-semibold text-slate-900">
                      Menu
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Đóng menu"
                    onClick={() => setMobileOpen(false)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <SidebarNav
                  pathname={pathname}
                  onNavigate={() => setMobileOpen(false)}
                />
              </aside>
            </div>
          ) : null}

          <div className="flex-1 px-3 py-4 sm:px-4 lg:px-5">
            <div className="sticky top-[61px] z-20 bg-slate-50/95 pt-1 backdrop-blur">
              <Suspense fallback={null}>
                <ContractSubNav />
              </Suspense>
            </div>
            <main className="w-full min-w-0">{children}</main>
          </div>
        </div>
      </div>
    </div>
  );
}
