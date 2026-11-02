'use client';

import type { ReactNode } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  PERIOD_MONTH_MAX,
  PERIOD_MONTH_MIN,
} from '@/lib/period-input-bounds';
import { cn } from '@/lib/utils';

/** Tiêu đề panel dashboard — bộ lọc luôn căn phải. */
export function DashboardPanelHeader({
  title,
  description,
  filters,
  className,
}: {
  title: ReactNode;
  description?: string;
  filters?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn('border-b border-slate-100 bg-white px-4 py-3', className)}
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
          {description ? (
            <p className="mt-0.5 text-xs text-slate-500">{description}</p>
          ) : null}
        </div>
        {filters ? (
          <div className="flex flex-wrap items-end justify-end gap-3">
            {filters}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function DashboardFilterField({
  id,
  label,
  children,
  className,
}: {
  id?: string;
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('w-[11rem] space-y-1', className)}>
      <Label htmlFor={id} className="text-xs text-slate-600">
        {label}
      </Label>
      {children}
    </div>
  );
}

export function DashboardMonthInput({
  id,
  value,
  onChange,
  max = PERIOD_MONTH_MAX,
  className,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  max?: string;
  className?: string;
}) {
  return (
    <Input
      id={id}
      type="month"
      min={PERIOD_MONTH_MIN}
      max={max}
      className={cn('h-9 bg-white', className)}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export const dashboardPanelShellClass =
  'overflow-hidden rounded-xl border border-slate-200 bg-white';
