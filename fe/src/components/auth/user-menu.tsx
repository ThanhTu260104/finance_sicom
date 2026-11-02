'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, KeyRound, LogOut, UserCog } from 'lucide-react';
import type { AppUser } from '@/lib/api/auth';
import { isSystemAdmin } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ChangePasswordDialog } from '@/components/auth/change-password-dialog';

/** Chữ cái đầu của 2 từ cuối tên (vd. "Trần Thanh Tú" → "TT") */
export function userInitials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '?';
  return words
    .slice(-2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

/** Avatar góc phải header: bấm mở menu (đổi mật khẩu, quản lý tài khoản) + nút Thoát */
export function UserMenu({
  user,
  onLogout,
}: {
  user: AppUser;
  onLogout: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="flex shrink-0 items-center gap-2">
      <div ref={boxRef} className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={cn(
            'flex items-center gap-2 rounded-full py-1 pl-1 pr-2 transition-colors hover:bg-slate-100',
            open && 'bg-slate-100',
          )}
          aria-haspopup="menu"
          aria-expanded={open}
          title="Tài khoản"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
            {userInitials(user.displayName)}
          </span>
          <span className="hidden text-left sm:block">
            <span className="block max-w-[12rem] truncate text-sm font-medium text-slate-900">
              {user.displayName}
            </span>
            <span className="block max-w-[12rem] truncate text-xs text-slate-500">
              {user.email}
            </span>
          </span>
          <ChevronDown className="h-4 w-4 text-slate-400" />
        </button>

        {open ? (
          <div
            role="menu"
            className="absolute right-0 z-40 mt-2 w-64 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
          >
            <div className="border-b border-slate-100 px-3 py-2">
              <p className="truncate text-sm font-medium text-slate-900">
                {user.displayName}
              </p>
              <p className="truncate text-xs text-slate-500">{user.email}</p>
            </div>
            <MenuItem
              icon={KeyRound}
              onClick={() => {
                setOpen(false);
                setPwOpen(true);
              }}
            >
              Đổi mật khẩu
            </MenuItem>
            {isSystemAdmin(user) ? (
              <Link
                href="/admin/users"
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                <UserCog className="h-4 w-4 text-slate-500" />
                Quản lý tài khoản
              </Link>
            ) : null}
            <div className="my-1 border-t border-slate-100" />
            <MenuItem icon={LogOut} onClick={onLogout}>
              Đăng xuất
            </MenuItem>
          </div>
        ) : null}
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onLogout}
        className="gap-1.5"
      >
        <LogOut className="h-4 w-4" />
        <span className="hidden sm:inline">Thoát</span>
      </Button>

      <ChangePasswordDialog open={pwOpen} onOpenChange={setPwOpen} />
    </div>
  );
}

function MenuItem({
  icon: Icon,
  onClick,
  children,
}: {
  icon: typeof LogOut;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
    >
      <Icon className="h-4 w-4 text-slate-500" />
      {children}
    </button>
  );
}
