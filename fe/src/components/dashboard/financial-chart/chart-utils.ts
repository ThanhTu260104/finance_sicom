import { formatCurrencyCompactVND, formatDate } from '@/lib/format';

export function parseChartAmount(value: string | undefined | null) {
  if (!value) return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function chartMax(values: number[], floor = 1) {
  const m = Math.max(...values, 0);
  return m > 0 ? m : floor;
}

export function axisMoneyLabel(value: number) {
  return formatCurrencyCompactVND(String(Math.round(value)));
}

/** Nhãn trên đỉnh điểm/cột — rút gọn; trả về '' nếu = 0 */
export function chartPointMoneyLabel(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '';
  return formatCurrencyCompactVND(String(Math.round(value)));
}

/** part/whole × 100 → chuỗi "38,52" (2 chữ số) */
export function percentOfAmounts(part: string, whole: string) {
  const p = parseChartAmount(part);
  const w = parseChartAmount(whole);
  if (w <= 0) return '0.00';
  return ((p / w) * 100).toFixed(2);
}

/** Nhãn trục: MM/YYYY (vd. 01/2026). */
export function formatPeriodAxisLabel(period: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(period);
  if (!match) return period;
  return `${match[2]}/${match[1]}`;
}

type TrendPointLabelSource = {
  period: string;
  label?: string;
  periodStartDate?: string | null;
  periodEndDate?: string | null;
};

/** Khoảng ngày của đợt: "(12/03/2026 - 11/06/2026)"; không có ngày → null */
export function trendPointRangeText(point: TrendPointLabelSource): string | null {
  if (!point.periodStartDate || !point.periodEndDate) return null;
  return `(${formatDate(point.periodStartDate)} - ${formatDate(point.periodEndDate)})`;
}

/** Nhãn đầy đủ: "Đợt 1 (12/03/2026 - 11/06/2026)"; điểm theo tháng → "03/2026" */
export function trendPointFullLabel(point: TrendPointLabelSource): string {
  if (!point.label) return formatPeriodAxisLabel(point.period);
  const range = trendPointRangeText(point);
  return range ? `${point.label} ${range}` : point.label;
}

/** Nhãn một dòng (trục xoay, ô chọn khoảng) — giống nhãn đầy đủ */
export const trendPointAxisLabel = trendPointFullLabel;
