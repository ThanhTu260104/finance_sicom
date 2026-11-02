'use client';

import type { ReactNode, TdHTMLAttributes, ThHTMLAttributes } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';

const STICKY_HEAD =
  'sticky top-0 z-20 border-b border-slate-200 bg-slate-100/95 px-3 py-2.5 text-xs font-bold normal-case tracking-normal text-slate-900 shadow-[0_1px_0_0_rgb(226_232_240)]';

/** Một vùng cuộn + table thuần (tránh wrapper overflow của ui/Table làm hỏng sticky). */
export function DashboardDataTable({
  minWidth = '52rem',
  maxHeightClass = 'max-h-[min(32rem,55vh)]',
  children,
  footer,
}: {
  minWidth?: string;
  maxHeightClass?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div
      className={cn('overflow-auto overscroll-contain', maxHeightClass)}
    >
      <table
        className="w-full table-fixed border-separate border-spacing-0 text-sm text-slate-800"
        style={{ minWidth }}
      >
        {children}
        {footer}
      </table>
    </div>
  );
}

export function DashboardStickyHeader({ children }: { children: ReactNode }) {
  return (
    <thead>
      <tr>{children}</tr>
    </thead>
  );
}

export function DashboardHead({
  className,
  align = 'left',
  width,
  children,
  ...rest
}: {
  className?: string;
  align?: 'left' | 'right';
  width?: string;
  children: ReactNode;
} & ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      {...rest}
      className={cn(
        STICKY_HEAD,
        'whitespace-nowrap align-middle',
        align === 'right' && 'text-right',
        className,
      )}
      style={width ? { width } : undefined}
    >
      {children}
    </th>
  );
}

/** Header bấm để sắp xếp theo giá trị cột. */
export function SortableDashboardHead<K extends string>({
  columnKey,
  sortKey,
  sortDesc,
  onSort,
  align = 'left',
  width,
  className,
  children,
}: {
  columnKey: K;
  sortKey: K;
  sortDesc: boolean;
  onSort: (key: K) => void;
  align?: 'left' | 'right';
  width?: string;
  className?: string;
  children: ReactNode;
}) {
  const active = sortKey === columnKey;
  return (
    <DashboardHead align={align} width={width} className={className}>
      <button
        type="button"
        onClick={() => onSort(columnKey)}
        className={cn(
          'inline-flex max-w-full items-center gap-0.5 rounded-sm text-left hover:text-slate-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-slate-400',
          align === 'right' && 'ml-auto flex-row-reverse text-right',
          active ? 'text-slate-950' : 'text-slate-800',
        )}
        aria-sort={
          active ? (sortDesc ? 'descending' : 'ascending') : 'none'
        }
      >
        <span className="min-w-0 leading-snug">{children}</span>
        {active ? (
          sortDesc ? (
            <ArrowDown className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
          ) : (
            <ArrowUp className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
          )
        ) : (
          <ArrowUpDown
            className="h-3 w-3 shrink-0 opacity-35"
            aria-hidden
          />
        )}
      </button>
    </DashboardHead>
  );
}

const ROW_DIVIDER =
  '[&_tr_td]:border-b [&_tr_td]:border-slate-200/55 [&_tr:last-child_td]:border-b-0';

export function DashboardTableBody({
  children,
  showRowDividers = true,
}: {
  children: ReactNode;
  /** Kẻ ngang nhẹ giữa các dòng (mặc định bật). */
  showRowDividers?: boolean;
}) {
  return (
    <tbody className={cn(showRowDividers && ROW_DIVIDER)}>{children}</tbody>
  );
}

export function DashboardTableRow({
  className,
  children,
  onClick,
  ...rest
}: {
  className?: string;
  children: ReactNode;
  onClick?: () => void;
} & React.ComponentPropsWithoutRef<'tr'>) {
  return (
    <tr
      onClick={onClick}
      className={cn(
        'transition-colors hover:bg-slate-50/80',
        onClick && 'cursor-pointer',
        className,
      )}
      {...rest}
    >
      {children}
    </tr>
  );
}

export function DashboardTextCell({
  className,
  children,
  ...rest
}: {
  className?: string;
  children: ReactNode;
} & TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      {...rest}
      className={cn('px-3 py-2 align-middle text-xs', className)}
    >
      {children}
    </td>
  );
}

export function DashboardMoneyCell({
  children,
  emphasize,
  className,
}: {
  children: ReactNode;
  emphasize?: 'amber' | 'red';
  className?: string;
}) {
  return (
    <td
      className={cn(
        'whitespace-nowrap px-3 py-2 text-right tabular-nums text-xs align-middle',
        emphasize === 'amber' && 'font-medium text-amber-800',
        emphasize === 'red' && 'font-medium text-red-700',
        className,
      )}
    >
      {children}
    </td>
  );
}
