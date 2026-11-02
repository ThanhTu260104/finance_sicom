'use client';

import {
  FinancialTooltip,
  type FinancialTooltipPayload,
} from './financial-tooltip';

/** Tooltip nổi trên vùng biểu đồ (không box cố định bên dưới). */
export function ChartTooltipOverlay({
  data,
  visible,
  leftPercent,
  top = 8,
}: {
  data: FinancialTooltipPayload;
  visible: boolean;
  /** 0–100, vị trí ngang trong vùng chart */
  leftPercent: number;
  top?: number;
}) {
  if (!visible) return null;

  const clamped = Math.min(Math.max(leftPercent, 8), 92);

  return (
    <div
      className="pointer-events-none absolute z-20 w-[min(100%,280px)] -translate-x-1/2"
      style={{ left: `${clamped}%`, top }}
    >
      <FinancialTooltip data={data} variant="floating" />
    </div>
  );
}
