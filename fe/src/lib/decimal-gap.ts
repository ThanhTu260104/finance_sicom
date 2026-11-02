import { compareDecimalStrings } from '@/lib/format';

const BIGINT_ZERO = BigInt(0);
const BIGINT_THOUSAND = BigInt(1000);

/** Phần nguyên (VND) — đủ cho lũy kế tỷ đồng. */
export function decimalIntPart(value: string): bigint {
  const raw = value.trim();
  if (!raw || raw === '—') return BIGINT_ZERO;
  const unsigned = raw.startsWith('-') ? raw.slice(1) : raw;
  const [intPart] = unsigned.split('.');
  try {
    return BigInt(intPart || '0');
  } catch {
    return BIGINT_ZERO;
  }
}

export function subtractDecimalInt(a: string, b: string): bigint {
  return decimalIntPart(a) - decimalIntPart(b);
}

/** % của value so với reference (0–100+, làm tròn 1 chữ số). */
export function percentOfReference(value: string, reference: string): number {
  return Math.min(percentOfReferenceRaw(value, reference), 150);
}

/** % đạt so với mốc — không giới hạn (dùng hiển thị số liệu). */
export function percentOfReferenceRaw(value: string, reference: string): number {
  const ref = decimalIntPart(reference);
  if (ref <= BIGINT_ZERO) return 0;
  const val = decimalIntPart(value);
  const pctTimes10 = (val * BIGINT_THOUSAND) / ref;
  return Number(pctTimes10) / 10;
}

export function formatAchievementPercent(value: string, reference: string): string {
  const pct = percentOfReferenceRaw(value, reference);
  const rounded = Math.round(pct * 10) / 10;
  if (Math.abs(rounded - Math.round(rounded)) < 1e-9) {
    return `${Math.round(rounded)}%`;
  }
  return `${rounded.toFixed(1).replace('.', ',')}%`;
}

export function sumDecimalIntStrings(amounts: string[]): string {
  let total = BIGINT_ZERO;
  for (const amount of amounts) {
    total += decimalIntPart(amount);
  }
  return total.toString();
}

export function isPositiveDecimal(value: string): boolean {
  return compareDecimalStrings(value.trim() || '0', '0') > 0;
}
