/**
 * Number grouping helpers (vi-VN): 7.500.000.000 / 1.250,5
 */

/** Strip grouping and normalize decimal to `.` for API/math. */
export function parseGroupedNumber(value: string | number | null | undefined) {
  if (value === null || value === undefined) return '';
  let raw = String(value).trim().replace(/\s/g, '').replace(/₫/g, '');
  if (!raw) return '';

  const negative = raw.startsWith('-');
  if (negative) raw = raw.slice(1);

  // 1.234.567,89 (vi) or mixed
  if (raw.includes(',') && raw.includes('.')) {
    if (raw.lastIndexOf(',') > raw.lastIndexOf('.')) {
      raw = raw.replace(/\./g, '').replace(',', '.');
    } else {
      raw = raw.replace(/,/g, '');
    }
  } else if (raw.includes(',')) {
    // 1234567,89 or 1,234,567
    const parts = raw.split(',');
    if (parts.length === 2 && parts[1].length <= 2) {
      raw = `${parts[0].replace(/\./g, '')}.${parts[1]}`;
    } else {
      raw = raw.replace(/,/g, '');
    }
  } else if (/^\d{1,3}(\.\d{3})+(\.\d+)?$/.test(raw)) {
    // 1.234.567 or 1.234.567.89 — treat dots as thousand seps except last if not group of 3
    const segments = raw.split('.');
    const last = segments[segments.length - 1];
    if (segments.length > 1 && last.length !== 3 && last.length <= 2) {
      raw = `${segments.slice(0, -1).join('')}.${last}`;
    } else {
      raw = segments.join('');
    }
  }

  if (!/^\d+(\.\d+)?$/.test(raw)) return '';
  return negative ? `-${raw}` : raw;
}

/** Format for input display with thousand separators (vi-VN). */
export function formatGroupedNumber(
  value: string | number | null | undefined,
  maxDecimals = 2,
) {
  const parsed = parseGroupedNumber(value);
  if (!parsed) return '';

  const negative = parsed.startsWith('-');
  const unsigned = negative ? parsed.slice(1) : parsed;
  const [intPart, decPart] = unsigned.split('.');

  try {
    const formattedInt = new Intl.NumberFormat('vi-VN').format(BigInt(intPart || '0'));
    const sign = negative ? '-' : '';
    if (decPart !== undefined && decPart.length > 0 && !/^0+$/.test(decPart)) {
      return `${sign}${formattedInt},${decPart.slice(0, maxDecimals)}`;
    }
    return `${sign}${formattedInt}`;
  } catch {
    return String(value ?? '');
  }
}

export function isValidGroupedAmount(value: string) {
  const parsed = parseGroupedNumber(value);
  if (!parsed) return false;
  return /^\d+(\.\d{1,2})?$/.test(parsed) && Number(parsed) >= 0;
}
