'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type TimeSeriesChartType = 'line' | 'area' | 'column';
export type ComparisonChartType =
  | 'horizontal-bar'
  | 'column'
  | 'grouped-bar'
  | 'stacked-bar';

const TIME_SERIES_OPTIONS: { id: TimeSeriesChartType; label: string }[] = [
  { id: 'line', label: 'Đường' },
  { id: 'area', label: 'Vùng' },
  { id: 'column', label: 'Cột' },
];

const COMPARISON_OPTIONS: { id: ComparisonChartType; label: string }[] = [
  { id: 'horizontal-bar', label: 'Cột ngang' },
  { id: 'column', label: 'Cột' },
  { id: 'grouped-bar', label: 'Cột nhóm' },
  { id: 'stacked-bar', label: 'Cột chồng' },
];

const SINGLE_OPTIONS: { id: 'horizontal-bar' | 'column'; label: string }[] = [
  { id: 'horizontal-bar', label: 'Cột ngang' },
  { id: 'column', label: 'Cột' },
];

export function TimeSeriesChartTypeSelector({
  value,
  onChange,
}: {
  value: TimeSeriesChartType;
  onChange: (v: TimeSeriesChartType) => void;
}) {
  return (
    <ChartTypeButtonGroup
      options={TIME_SERIES_OPTIONS}
      value={value}
      onChange={onChange}
    />
  );
}

export function ComparisonChartTypeSelector({
  value,
  onChange,
}: {
  value: ComparisonChartType;
  onChange: (v: ComparisonChartType) => void;
}) {
  return (
    <ChartTypeButtonGroup
      options={COMPARISON_OPTIONS}
      value={value}
      onChange={onChange}
    />
  );
}

export function SingleMetricChartTypeSelector({
  value,
  onChange,
}: {
  value: 'horizontal-bar' | 'column';
  onChange: (v: 'horizontal-bar' | 'column') => void;
}) {
  return (
    <ChartTypeButtonGroup
      options={SINGLE_OPTIONS}
      value={value}
      onChange={onChange}
    />
  );
}

function ChartTypeButtonGroup<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map((opt) => (
        <Button
          key={opt.id}
          type="button"
          size="sm"
          variant={value === opt.id ? 'default' : 'outline'}
          className={cn('h-8 text-xs', value === opt.id && 'shadow-sm')}
          onClick={() => onChange(opt.id)}
        >
          {opt.label}
        </Button>
      ))}
    </div>
  );
}
