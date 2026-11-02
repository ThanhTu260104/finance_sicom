'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

const STORAGE_PREFIX = 'dashboard-section:';

/**
 * Khối dashboard thu gọn được. Nội dung chỉ render khi mở → trang nhẹ hơn
 * (khối tự gọi API cũng chỉ gọi khi mở). Trạng thái mở/đóng nhớ theo trình duyệt.
 */
export function DashboardCollapsible({
  id,
  title,
  summary,
  defaultOpen = false,
  children,
}: {
  /** Khóa lưu trạng thái (localStorage) */
  id: string;
  title: string;
  /** Thông tin ngắn hiện cạnh tiêu đề khi đang thu gọn */
  summary?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const stored = window.localStorage.getItem(STORAGE_PREFIX + id);
        if (stored === '1') setOpen(true);
        if (stored === '0') setOpen(false);
      } catch {
        // ignore storage access errors
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [id]);

  const toggle = () => {
    setOpen((value) => {
      const next = !value;
      try {
        window.localStorage.setItem(STORAGE_PREFIX + id, next ? '1' : '0');
      } catch {
        // ignore storage access errors
      }
      return next;
    });
  };

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className={cn(
          'flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50',
          open && 'border-b border-slate-100',
        )}
      >
        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 text-slate-400 transition-transform',
            !open && '-rotate-90',
          )}
        />
        <span className="text-sm font-semibold uppercase tracking-wide text-slate-700">
          {title}
        </span>
        {!open && summary ? (
          <span className="ml-auto truncate text-xs text-slate-500">{summary}</span>
        ) : null}
      </button>
      {open ? <div className="space-y-4 p-3 sm:p-4">{children}</div> : null}
    </section>
  );
}
