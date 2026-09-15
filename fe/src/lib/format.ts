import { format, parseISO, isValid } from 'date-fns';

/**
 * Format VND without losing Decimal string precision for integer part.
 * Example: "7500000000" → "7.500.000.000 ₫"
 */
export function formatCurrencyVND(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') return '—';
  const raw = String(value).trim();
  if (!/^-?\d+(\.\d+)?$/.test(raw)) return '—';

  const negative = raw.startsWith('-');
  const unsigned = negative ? raw.slice(1) : raw;
  const [intPart, decPart] = unsigned.split('.');

  try {
    const formattedInt = new Intl.NumberFormat('vi-VN').format(BigInt(intPart));
    const sign = negative ? '-' : '';
    if (decPart && !/^0+$/.test(decPart)) {
      return `${sign}${formattedInt},${decPart} ₫`;
    }
    return `${sign}${formattedInt} ₫`;
  } catch {
    return '—';
  }
}

export function formatDate(value?: string | null) {
  if (!value) return '—';
  const date = typeof value === 'string' ? parseISO(value) : value;
  if (!isValid(date)) return '—';
  return format(date, 'dd/MM/yyyy');
}

export function toDateInputValue(value?: string | null) {
  if (!value) return '';
  const date = parseISO(value);
  if (!isValid(date)) return '';
  return format(date, 'yyyy-MM-dd');
}

/** Display period "2026-08" as "08/2026". */
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
