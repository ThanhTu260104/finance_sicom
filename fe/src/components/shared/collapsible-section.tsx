'use client';

import { useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function CollapsibleSection({
  title,
  description,
  defaultOpen = false,
  children,
  className,
}: {
  title: string;
  description?: string;
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={cn('rounded-lg border border-slate-200 bg-white', className)}>
      <div className="flex items-start justify-between gap-3 px-3 py-2.5">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-800">{title}</p>
          {description ? (
            <p className="text-xs text-slate-500">{description}</p>
          ) : null}
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          {open ? 'Thu gọn' : 'Mở'}
          <ChevronDown
            className={cn('h-4 w-4 transition-transform', open && 'rotate-180')}
          />
        </Button>
      </div>
      {open ? <div className="border-t border-slate-100 p-3">{children}</div> : null}
    </div>
  );
}
