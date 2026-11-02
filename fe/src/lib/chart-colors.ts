/** Màu biểu đồ: xanh = tốt/đã đạt, cam = chờ/cảnh báo, đỏ = thiếu/chậm */
export const CHART_GREEN = '#16a34a';
export const CHART_ORANGE = '#ea580c';
export const CHART_RED = '#dc2626';
export const CHART_SLATE = '#475569';
export const CHART_BLUE = '#2563eb';

/** Ba chuỗi dashboard (KH / NT / thu) — tương phản rõ, ấm hơn slate–green–blue cũ */
export const CHART_SERIES_PLAN = '#b45309';
export const CHART_SERIES_ACCEPTANCE = '#15803d';
export const CHART_SERIES_COLLECTION = '#1d4ed8';
/** Chi phí vận hành dự án — tách màu khỏi KH/NT/thu */
export const CHART_SERIES_OPERATING_COST = '#9333ea';
/** Giá trị thực hiện tháng (không phải KH thực hiện) */
export const CHART_SERIES_ACTUAL_WORK = '#0d9488';

const PIE_BY_KEY: Record<string, string> = {
  COLLECTED: CHART_GREEN,
  PLAN_COMPLETED: CHART_GREEN,
  ACCEPTED: CHART_GREEN,
  ACTUAL_WORK: CHART_GREEN,
  SUBMITTED: CHART_GREEN,

  WAITING_PAYMENT: CHART_ORANGE,
  PENDING_SUBMISSION: CHART_ORANGE,
  UNPERFORMED: CHART_ORANGE,
  PLAN_REMAINING: CHART_ORANGE,
  REMAINING: CHART_ORANGE,
  REMAINING_CONTRACT: CHART_ORANGE,
  OUTSTANDING: CHART_ORANGE,

  NOT_ACCEPTED: CHART_RED,
  UNACCEPTED: CHART_RED,
  PLAN_SHORTFALL: CHART_RED,
};

export function pieColorForKey(key: string, fallbackIndex: number) {
  const mapped = PIE_BY_KEY[key];
  if (mapped) return mapped;
  const fallbacks = [CHART_GREEN, CHART_ORANGE, CHART_RED, CHART_SLATE];
  return fallbacks[fallbackIndex % fallbacks.length];
}
