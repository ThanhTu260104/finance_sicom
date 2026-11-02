'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  ChartContextBar,
  type ChartContextItem,
} from './chart-context-bar';

export function ChartFullscreenModal({
  open,
  onClose,
  title,
  contextItems,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  contextItems?: ChartContextItem[];
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col bg-slate-950/55 p-2 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div
        className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
            Đóng
          </Button>
        </header>
        {contextItems?.length ? (
          <ChartContextBar items={contextItems} />
        ) : null}
        <div className="min-h-0 flex-1 overflow-auto p-3 sm:p-5">{children}</div>
      </div>
    </div>
  );
}
