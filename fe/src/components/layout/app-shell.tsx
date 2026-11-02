'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BookOpen,
  Building2,
  CalendarDays,
  ChartColumn,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FilePlus,
  FileText,
  FolderCog,
  FolderKanban,
  Handshake,
  LayoutDashboard,
  Menu,
  Ellipsis,
  Eye,
  Tags,
  X,
  Zap,
  UserCog,
  Upload,
  Music2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ContractSubNav } from '@/components/layout/contract-sub-nav';
import { useAuth } from '@/components/auth/auth-provider';
import { UserMenu } from '@/components/auth/user-menu';
import { isSystemAdmin } from '@/lib/api';
import { AppLogo } from '@/components/brand/app-logo';
import {
  GUIDE_PATH,
  featureMatchesPath,
  hasFeature,
  isLimitedUser,
  isReadOnlyUser,
  userFeatures,
} from '@/lib/features';

type NavLink = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  match?: (pathname: string) => boolean;
};

type NavSection = {
  title?: string;
  /** Nhóm gập/mở (vd. "Khác") — tự mở khi đang ở một mục bên trong */
  collapsible?: boolean;
  icon?: typeof LayoutDashboard;
  items: NavLink[];
};

const SIDEBAR_STORAGE_KEY = 'finance-sidebar-collapsed';

function buildNavSections(
  showAdminUsers: boolean,
  readOnly: boolean,
): NavSection[] {
  const topItems: NavLink[] = [
    {
      href: '/',
      label: 'Dashboard',
      icon: LayoutDashboard,
      match: (pathname) => pathname === '/',
    },
  ];
  // Nhập nhanh chỉ để ghi dữ liệu → ẩn với tài khoản chỉ xem
  if (!readOnly) {
    topItems.push({
      href: '/quick-entry',
      label: 'Nhập nhanh',
      icon: Zap,
      match: (pathname) => pathname.startsWith('/quick-entry'),
    });
  }
  topItems.push({
    href: GUIDE_PATH,
    label: 'Hướng dẫn',
    icon: BookOpen,
    match: (pathname) => pathname === GUIDE_PATH,
  });
  if (showAdminUsers) {
    topItems.push({
      href: '/admin/dashboard',
      label: 'Dashboard Admin',
      icon: LayoutDashboard,
      match: (pathname) => pathname.startsWith('/admin/dashboard'),
    });
    topItems.push({
      href: '/admin/users',
      label: 'Tài khoản',
      icon: UserCog,
      match: (pathname) => pathname.startsWith('/admin/users'),
    });
  }
  return [
  {
    items: topItems,
  },
  {
    title: 'QUẢN LÝ DỰ ÁN',
    items: [
      {
        href: '/projects',
        label: 'Dự án',
        icon: FolderKanban,
        match: (pathname) =>
          pathname.startsWith('/projects') &&
          !pathname.startsWith('/projects/report-submissions'),
      },
      {
        href: '/contracts',
        label: 'Hợp đồng',
        icon: FileText,
        match: (pathname) =>
          pathname.startsWith('/contracts') &&
          !pathname.startsWith('/contracts/statistics') &&
          !pathname.startsWith('/contracts/maintenance'),
      },
    ],
  },
  {
    title: 'Danh mục quản trị',
    collapsible: true,
    icon: FolderCog,
    items: [
      {
        href: '/customers',
        label: 'Đối tác',
        icon: Handshake,
        match: (pathname) => pathname.startsWith('/customers'),
      },
      {
        href: '/companies',
        label: 'Công ty',
        icon: Building2,
        match: (pathname) => pathname.startsWith('/companies'),
      },
      {
        href: '/cost-categories',
        label: 'Loại chi phí',
        icon: Tags,
        match: (pathname) => pathname.startsWith('/cost-categories'),
      },
    ],
  },
  {
    title: 'Khác',
    collapsible: true,
    icon: Ellipsis,
    items: [
      {
        href: '/contracts/statistics',
        label: 'Thống kê hợp đồng',
        icon: ChartColumn,
        match: (pathname) => pathname.startsWith('/contracts/statistics'),
      },
      {
        href: '/contracts/maintenance',
        label: 'Bảo trì theo ngày',
        icon: CalendarDays,
        match: (pathname) => pathname.startsWith('/contracts/maintenance'),
      },
      {
        href: '/projects/report-submissions',
        label: 'Nộp báo cáo',
        icon: Upload,
        match: (pathname) =>
          pathname.startsWith('/projects/report-submissions'),
      },
      {
        href: '/music-voting',
        label: 'Bình chọn ca khúc',
        icon: Music2,
        match: (pathname) => pathname.startsWith('/music-voting'),
      },
    ],
  },
];
}

function isActive(item: NavLink, pathname: string) {
  if (item.match) return item.match(pathname);
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function SidebarNavLink({
  item,
  pathname,
  collapsed,
  nested,
  onNavigate,
}: {
  item: NavLink;
  pathname: string;
  collapsed?: boolean;
  nested?: boolean;
  onNavigate?: () => void;
}) {
  const active = isActive(item, pathname);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      title={collapsed ? item.label : undefined}
      className={cn(
        'flex items-center rounded-md text-sm font-medium transition-colors',
        collapsed
          ? 'justify-center px-2 py-2.5'
          : cn('gap-2.5 px-3 py-2', nested && 'pl-6'),
        active ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100',
      )}
      aria-current={active ? 'page' : undefined}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {!collapsed ? <span>{item.label}</span> : null}
    </Link>
  );
}

function CollapsibleNavSection({
  section,
  pathname,
  collapsed,
  onNavigate,
}: {
  section: NavSection;
  pathname: string;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const hasActive = section.items.some((item) => isActive(item, pathname));
  const [open, setOpen] = useState(hasActive);
  const expanded = open || hasActive;
  const Icon = section.icon ?? Ellipsis;

  // Menu thu gọn (chỉ icon): hiện thẳng các mục, không có tiêu đề nhóm
  if (collapsed) {
    return (
      <div className="space-y-1 border-t border-slate-200/80 pt-3">
        {section.items.map((item) => (
          <SidebarNavLink
            key={item.href}
            item={item}
            pathname={pathname}
            collapsed
            onNavigate={onNavigate}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={expanded}
        className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span className="flex-1 text-left">{section.title}</span>
        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 text-slate-400 transition-transform',
            expanded && 'rotate-180',
          )}
        />
      </button>
      {expanded
        ? section.items.map((item) => (
            <SidebarNavLink
              key={item.href}
              item={item}
              pathname={pathname}
              nested
              onNavigate={onNavigate}
            />
          ))
        : null}
    </div>
  );
}

function SidebarNav({
  pathname,
  collapsed,
  onNavigate,
  sections,
}: {
  pathname: string;
  collapsed?: boolean;
  onNavigate?: () => void;
  sections: NavSection[];
}) {
  return (
    <nav
      className={cn(
        'flex flex-1 flex-col gap-6 overflow-y-auto py-4',
        collapsed ? 'px-2' : 'px-3',
      )}
    >
      {sections.map((section, sectionIndex) =>
        section.collapsible ? (
          <CollapsibleNavSection
            key={section.title ?? `section-${sectionIndex}`}
            section={section}
            pathname={pathname}
            collapsed={collapsed}
            onNavigate={onNavigate}
          />
        ) : (
          <div
            key={section.title ?? `section-${sectionIndex}`}
            className="space-y-1"
          >
            {section.title && !collapsed ? (
              <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                {section.title}
              </p>
            ) : null}
            {section.items.map((item) => (
              <SidebarNavLink
                key={item.href}
                item={item}
                pathname={pathname}
                collapsed={collapsed}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        ),
      )}
    </nav>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const limited = isLimitedUser(user);
  const readOnly = isReadOnlyUser(user);
  // Tài khoản giới hạn: menu chỉ gồm các tính năng được cấp
  const navSections: NavSection[] = limited
    ? [
        {
          title: 'Tính năng được cấp',
          items: userFeatures(user).map((f) => ({
            href: f.href,
            label: f.label,
            icon: f.key === 'contracts.create' ? FilePlus : FileText,
            match: (pathname: string) => featureMatchesPath(f, pathname),
          })),
        },
        {
          items: [
            {
              href: GUIDE_PATH,
              label: 'Hướng dẫn',
              icon: BookOpen,
              match: (pathname: string) => pathname === GUIDE_PATH,
            },
          ],
        },
      ]
    : buildNavSections(isSystemAdmin(user), readOnly);
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
              <AppLogo size={44} linked />
            ) : (
              <div className="flex justify-center">
                <AppLogo size={36} iconOnly linked />
              </div>
            )}
          </div>
          <SidebarNav
            pathname={pathname}
            collapsed={collapsed}
            sections={navSections}
          />
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
            <div className="flex min-w-0 flex-1 items-center gap-3">
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
                <AppLogo size={36} linked className="gap-2" />
              </div>
              <div className="hidden min-w-0 md:block">
                <h1 className="font-serif text-xl font-semibold tracking-tight text-slate-900">
                  Quản lý dự án &amp; nghiệm thu
                </h1>
              </div>
            </div>
            {user ? <UserMenu user={user} onLogout={() => logout()} /> : null}
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
                  <AppLogo size={40} linked />
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
                  sections={navSections}
                />
              </aside>
            </div>
          ) : null}

          <div className="flex-1 px-3 py-4 sm:px-4 lg:px-5">
            <div className="sticky top-[61px] z-20 bg-slate-50/95 pt-1 backdrop-blur">
              {hasFeature(user, 'contracts.list') ? (
                <Suspense fallback={null}>
                  <ContractSubNav />
                </Suspense>
              ) : null}
            </div>
            {readOnly ? (
              <div className="mb-3 flex items-center gap-2 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-800">
                <Eye className="h-4 w-4 shrink-0" />
                Tài khoản chỉ xem — bạn xem được mọi số liệu nhưng không thêm,
                sửa hoặc xóa dữ liệu.
              </div>
            ) : null}
            <main className="w-full min-w-0">{children}</main>
          </div>
        </div>
      </div>
    </div>
  );
}
