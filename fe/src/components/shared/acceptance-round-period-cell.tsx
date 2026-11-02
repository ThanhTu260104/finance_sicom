'use client';

import {
  acceptanceRoundIndex,
  contractAcceptanceSchedulePeriods,
  formatAcceptanceRoundLabel,
  type ContractAcceptanceScheduleInput,
} from '@/lib/acceptance-plan-periods';
import { formatPeriod } from '@/lib/format';
import { useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';

export function AcceptanceRoundPeriodCell({
  period,
  contractMeta,
  showPeriodSubtitle = true,
}: {
  period: string;
  contractMeta?: ContractAcceptanceScheduleInput | null;
  showPeriodSubtitle?: boolean;
}) {
  const schedule = useMemo(
    () => (contractMeta ? contractAcceptanceSchedulePeriods(contractMeta) : []),
    [contractMeta],
  );
  const round = acceptanceRoundIndex(period, schedule);
  const roundLabel = formatAcceptanceRoundLabel(round);

  return (
    <div className="leading-tight">
      <span className="font-medium text-slate-900">{roundLabel}</span>
      {showPeriodSubtitle ? (
        <p className="text-xs text-slate-500">
          {round != null ? `Kỳ ${formatPeriod(period)}` : formatPeriod(period)}
        </p>
      ) : null}
    </div>
  );
}

/** Chọn đợt NT theo lịch HĐ — gán kỳ YYYY-MM (tháng cuối đợt). */
export function AcceptanceRoundPeriodSelect({
  contractMeta,
  period,
  onPeriodChange,
  onAcceptanceNoChange,
  id,
}: {
  contractMeta: ContractAcceptanceScheduleInput;
  period: string;
  onPeriodChange: (period: string) => void;
  onAcceptanceNoChange?: (acceptanceNo: string) => void;
  id?: string;
}) {
  const schedule = useMemo(
    () => contractAcceptanceSchedulePeriods(contractMeta),
    [contractMeta],
  );

  if (schedule.length === 0) {
    return (
      <div className="space-y-1.5">
        <Label htmlFor={id}>Kỳ NT (YYYY-MM)</Label>
        <Input
          id={id}
          value={period}
          onChange={(e) => onPeriodChange(e.target.value)}
          placeholder="2026-09"
        />
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>Đợt nghiệm thu (theo HĐ)</Label>
      <Select
        id={id}
        value={period && schedule.includes(period) ? period : schedule[0]}
        onChange={(e) => {
          const next = e.target.value;
          onPeriodChange(next);
          const idx = acceptanceRoundIndex(next, schedule);
          if (idx != null && onAcceptanceNoChange) {
            onAcceptanceNoChange(formatAcceptanceRoundLabel(idx));
          }
        }}
      >
        {schedule.map((p, i) => (
          <option key={p} value={p}>
            {`Đợt ${i + 1} — kỳ ${formatPeriod(p)}`}
          </option>
        ))}
      </Select>
    </div>
  );
}
