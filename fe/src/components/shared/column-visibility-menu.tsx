'use client';

import { useEffect, useRef, useState } from 'react';
import { Columns3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ColumnDef } from '@/hooks/use-column-visibility';

export function ColumnVisibilityMenu<K extends string>({
  columns,
  isVisible,
  toggle,
  showAll,
  reset,
}: {
  columns: Array<ColumnDef<K>>;
  isVisible: (key: K) => boolean;
  toggle: (key: K, checked: boolean) => void;
  showAll: () => void;
  reset: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    return () => document.removeEventListener('mousedown', onPointer);
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <Columns3 className="h-4 w-4" />
        Cột
      </Button>
      {open ? (
        <div className="absolute right-0 z-30 mt-1 w-56 rounded-md border border-slate-200 bg-white p-2 shadow-lg">
          <p className="mb-2 px-1 text-xs font-medium uppercase tracking-wide text-slate-500">
            Ẩn / hiện cột
          </p>
          <ul className="max-h-64 space-y-1 overflow-auto">
            {columns.map((col) => (
              <li key={col.key}>
                <label className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm text-slate-700 hover:bg-slate-50">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 rounded border-slate-300"
                    checked={isVisible(col.key)}
                    disabled={col.locked}
                    onChange={(e) => toggle(col.key, e.target.checked)}
                  />
                  <span className={col.locked ? 'text-slate-400' : undefined}>
                    {col.label}
                    {col.locked ? ' (cố định)' : ''}
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex gap-1 border-t border-slate-100 pt-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="flex-1"
              onClick={showAll}
            >
              Hiện tất cả
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="flex-1"
              onClick={reset}
            >
              Mặc định
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
