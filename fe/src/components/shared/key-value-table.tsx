'use client';

import type { ReactNode } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

export type KeyValueRow = {
  label: string;
  value: ReactNode;
  tone?: 'danger' | 'success' | 'warning' | 'default';
  hint?: string;
};

export function KeyValueTable({
  rows,
  className,
  labelWidthClass = 'w-[40%] sm:w-[34%]',
  compact = false,
  showHeader = true,
}: {
  rows: KeyValueRow[];
  className?: string;
  labelWidthClass?: string;
  compact?: boolean;
  showHeader?: boolean;
}) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-lg border border-slate-200',
        className,
      )}
    >
      <Table>
        {showHeader ? (
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead
                className={cn(
                  labelWidthClass,
                  compact && 'py-2 text-xs',
                )}
              >
                Hạng mục
              </TableHead>
              <TableHead className={cn(compact && 'py-2 text-xs')}>
                Giá trị
              </TableHead>
            </TableRow>
          </TableHeader>
        ) : null}
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.label} className="hover:bg-slate-50/80">
              <TableCell
                className={cn(
                  'whitespace-normal font-medium text-slate-600',
                  compact ? 'py-1.5 text-xs sm:text-sm' : 'text-sm',
                  labelWidthClass,
                )}
              >
                {row.label}
              </TableCell>
              <TableCell
                className={cn(
                  'whitespace-normal text-slate-900',
                  compact ? 'py-1.5 text-sm' : 'text-sm',
                )}
              >
                <div className="font-semibold">{row.value ?? '—'}</div>
                {row.hint ? (
                  <p className="mt-0.5 text-xs font-normal text-slate-500">
                    {row.hint}
                  </p>
                ) : null}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
