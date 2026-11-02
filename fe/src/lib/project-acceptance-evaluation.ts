import { compareDecimalStrings, formatCurrencyVND } from '@/lib/format';

/** Đánh giá lũy kế: lệch KH NT (số tiền) hoặc đủ/theo kế hoạch. */
export function projectAcceptanceEvaluation(row: {
  acceptancePercent: string;
  acceptanceGap: string;
}): { label: string; className: string } {
  const pct = Number(row.acceptancePercent) || 0;
  const behindPlan = compareDecimalStrings(row.acceptanceGap, '0') > 0;
  const gapMoney = formatCurrencyVND(row.acceptanceGap);

  if (pct >= 100) {
    return {
      label: 'Đủ giá trị HĐ',
      className: 'text-emerald-800',
    };
  }
  if (!behindPlan) {
    return {
      label: 'Theo kế hoạch NT',
      className: 'text-emerald-700',
    };
  }
  return {
    label: `Chậm ${gapMoney}`,
    className: pct >= 50 ? 'text-amber-800' : 'text-red-700',
  };
}
