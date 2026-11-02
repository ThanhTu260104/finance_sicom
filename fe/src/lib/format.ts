import { format, parseISO, isValid } from 'date-fns';
import { calendarYmdInVn } from '@/lib/calendar-date-vn';

/** Ngày từ API (lịch VN, có thể kết thúc ngày cũ 23:59 UTC). */
function calendarPartsFromApiDate(d: Date): {
  year: number;
  month: number;
  day: number;
} {
  const uh = d.getUTCHours();
  const um = d.getUTCMinutes();
  if (uh === 23 && um >= 59) {
    return {
      year: d.getUTCFullYear(),
      month: d.getUTCMonth() + 1,
      day: d.getUTCDate(),
    };
  }
  return calendarYmdInVn(d);
}

function formatDdMmYyyy(parts: {
  year: number;
  month: number;
  day: number;
}): string {
  const dd = String(parts.day).padStart(2, '0');
  const mm = String(parts.month).padStart(2, '0');
  return `${dd}/${mm}/${parts.year}`;
}

/** Làm tròn VND về số nguyên (xét chữ số thập phân đầu tiên). */
function roundVndUnsigned(unsigned: string): bigint {
  const [intPart = '0', decPart = ''] = unsigned.split('.');
  let n = BigInt(intPart || '0');
  const first = decPart[0];
  if (first && first >= '5') n += BigInt(1);
  return n;
}

/**
 * Format VND — làm tròn số nguyên, không hiển thị ,00.
 * Example: "7500000000.00" → "7.500.000.000 ₫"
 */
export function formatCurrencyVND(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') return '—';
  const raw = String(value).trim();
  if (!/^-?\d+(\.\d+)?$/.test(raw)) return '—';

  const negative = raw.startsWith('-');
  const unsigned = negative ? raw.slice(1) : raw;

  try {
    const rounded = roundVndUnsigned(unsigned);
    const formattedInt = new Intl.NumberFormat('vi-VN').format(rounded);
    const sign = negative ? '-' : '';
    return `${sign}${formattedInt} ₫`;
  } catch {
    return '—';
  }
}

/**
 * Chênh lệch lưu dạng kế hoạch − nghiệm thu.
 * NT vượt KH (âm) → hiển thị +; chưa đủ NT (dương) → số dương thông thường.
 */
export function formatPlanAcceptanceGapVND(
  gap: string | number | null | undefined,
) {
  if (gap === null || gap === undefined || gap === '') return '—';
  const raw = String(gap).trim();
  if (!/^-?\d+(\.\d+)?$/.test(raw)) return '—';

  const cmp = compareDecimalStrings(raw, '0');
  if (cmp === 0) return formatCurrencyVND('0');
  if (cmp < 0) {
    const abs = raw.startsWith('-') ? raw.slice(1) : raw;
    return `+${formatCurrencyVND(abs)}`;
  }
  return formatCurrencyVND(raw);
}

export function formatDate(value?: string | null) {
  if (!value) return '—';
  const date = typeof value === 'string' ? parseISO(value) : value;
  if (!isValid(date)) return '—';
  return formatDdMmYyyy(calendarPartsFromApiDate(date));
}

export function toDateInputValue(value?: string | null) {
  if (!value) return '';
  const date = parseISO(value);
  if (!isValid(date)) return '';
  const { year, month, day } = calendarPartsFromApiDate(date);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Display period "2026-08" as "08/2026". */
/** Rút gọn KPI: 120,5 tỷ / 850,2 triệu — tooltip vẫn dùng formatCurrencyVND đầy đủ. */
export function formatCurrencyCompactVND(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') return '—';
  const raw = String(value).trim();
  if (!/^-?\d+(\.\d+)?$/.test(raw)) return '—';
  const negative = raw.startsWith('-');
  const unsigned = negative ? raw.slice(1) : raw;
  const intPart = unsigned.split('.')[0] || '0';
  let n: bigint;
  try {
    n = BigInt(intPart);
  } catch {
    return formatCurrencyVND(value);
  }
  const ZERO = BigInt(0);
  const TEN = BigInt(10);
  const abs = n < ZERO ? -n : n;
  const sign = negative ? '-' : '';
  const B = BigInt(1_000_000_000);
  const M = BigInt(1_000_000);
  if (abs >= B) {
    const whole = Number(abs / B);
    const frac = Number(((abs % B) * TEN) / B);
    const label =
      frac > 0 ? `${whole},${frac} tỷ` : `${whole.toLocaleString('vi-VN')} tỷ`;
    return `${sign}${label}`;
  }
  if (abs >= M) {
    const whole = Number(abs / M);
    const frac = Number(((abs % M) * TEN) / M);
    const label =
      frac > 0 ? `${whole},${frac} triệu` : `${whole.toLocaleString('vi-VN')} triệu`;
    return `${sign}${label}`;
  }
  return formatCurrencyVND(value);
}

/** Chuẩn hóa phần trăm — bỏ ,00 thừa (96,00% → 96%). */
export function formatPercentDisplay(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') return '—';
  const raw = String(value).trim().replace(',', '.');
  if (!raw) return '—';
  const n = Number(raw);
  if (!Number.isFinite(n)) return '—';
  let text = n.toFixed(2);
  if (text.endsWith('.00')) {
    text = text.slice(0, -3);
  } else {
    text = text.replace(/0+$/, '').replace(/\.$/, '');
  }
  return `${text.replace('.', ',')}%`;
}

export function formatPeriod(period?: string | null) {
  if (!period) return '—';
  const match = /^(\d{4})-(\d{2})$/.exec(period);
  if (!match) return period;
  return `${match[2]}/${match[1]}`;
}

/** Compare two decimal strings without floating-point math. Returns -1, 0, 1. */
export function compareDecimalStrings(a: string, b: string) {
  const left = a.trim();
  const right = b.trim();
  const leftNeg = left.startsWith('-');
  const rightNeg = right.startsWith('-');
  if (leftNeg !== rightNeg) return leftNeg ? -1 : 1;

  const norm = (value: string) => {
    const unsigned = value.replace(/^-/, '');
    const [i = '0', d = ''] = unsigned.split('.');
    return { intPart: i.replace(/^0+(?=\d)/, '') || '0', decPart: d };
  };

  const A = norm(left);
  const B = norm(right);
  const maxDec = Math.max(A.decPart.length, B.decPart.length);
  const pad = (part: string) => part.padEnd(maxDec, '0');
  const leftKey = `${A.intPart.padStart(Math.max(A.intPart.length, B.intPart.length), '0')}${pad(A.decPart)}`;
  const rightKey = `${B.intPart.padStart(Math.max(A.intPart.length, B.intPart.length), '0')}${pad(B.decPart)}`;

  if (leftKey === rightKey) return 0;
  const cmp = leftKey > rightKey ? 1 : -1;
  return leftNeg ? -cmp : cmp;
}

export function isNegativeDecimal(value: string) {
  return value.trim().startsWith('-') && !/^-?0+(\.0+)?$/.test(value.trim());
}
