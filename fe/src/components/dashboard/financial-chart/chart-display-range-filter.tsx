'use client';

import { formatPeriod as formatMonth } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';

export function ChartDisplayRangeFilter({
  periods,
  fromPeriod,
  toPeriod,
  onFromChange,
  onToChange,
  onReset,
  labels,
}: {
  periods: string[];
  fromPeriod: string;
  toPeriod: string;
  onFromChange: (p: string) => void;
  onToChange: (p: string) => void;
  onReset: () => void;
  /** Nhãn hiển thị thay cho tháng (vd. biểu đồ theo đợt: period → "Đợt 1") */
  labels?: Map<string, string>;
}) {
  const formatPeriod = (p: string) => labels?.get(p) ?? formatMonth(p);
  if (periods.length === 0) return null;

  return (
    <div className="flex flex-wrap items-end gap-2 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2">
      <div className="space-y-0.5">
        <Label className="text-[10px] text-slate-500">Hiển thị từ</Label>
        <Select
          className="h-8 min-w-[7rem] text-xs"
          value={fromPeriod}
          onChange={(e) => onFromChange(e.target.value)}
        >
          {periods.map((p) => (
            <option key={p} value={p}>
              {formatPeriod(p)}
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-0.5">
        <Label className="text-[10px] text-slate-500">Đến</Label>
        <Select
          className="h-8 min-w-[7rem] text-xs"
          value={toPeriod}
          onChange={(e) => onToChange(e.target.value)}
        >
          {periods.map((p) => (
            <option key={p} value={p}>
              {formatPeriod(p)}
            </option>
          ))}
        </Select>
      </div>
      <Button type="button" size="sm" variant="outline" className="h-8" onClick={onReset}>
        Full khoảng
      </Button>
    </div>
  );
}
