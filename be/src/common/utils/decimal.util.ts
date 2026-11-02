import { Decimal } from '@prisma/client/runtime/library';

/** Normalize Prisma Decimal / number / string to a plain decimal string. */
export function toDecimalString(value: Decimal | string | number): string {
  if (value instanceof Decimal) {
    return value.toFixed();
  }
  return new Decimal(value).toFixed();
}

export function sumDecimals(values: Array<Decimal | string | number>): Decimal {
  return values.reduce<Decimal>(
    (acc, value) => acc.add(new Decimal(value)),
    new Decimal(0),
  );
}

export function subtractDecimals(
  left: Decimal | string | number,
  right: Decimal | string | number,
): Decimal {
  return new Decimal(left).sub(new Decimal(right));
}

export function maxDecimal(
  left: Decimal | string | number,
  right: Decimal | string | number,
): Decimal {
  const a = new Decimal(left);
  const b = new Decimal(right);
  return a.gte(b) ? a : b;
}

export function compareDecimals(
  left: Decimal | string | number,
  right: Decimal | string | number,
): number {
  const result = new Decimal(left).cmp(new Decimal(right));
  return result;
}

/** Chia đều total thành count phần; phần cuối hút lệch làm tròn. */
export function splitDecimalEqually(
  total: Decimal | string | number,
  count: number,
): Decimal[] {
  if (count <= 0) return [];
  const t = new Decimal(total);
  if (count === 1) return [t];
  const per = t.div(count).toDecimalPlaces(2, Decimal.ROUND_DOWN);
  const out: Decimal[] = [];
  let allocated = new Decimal(0);
  for (let i = 0; i < count - 1; i++) {
    out.push(per);
    allocated = allocated.add(per);
  }
  out.push(t.sub(allocated));
  return out;
}

export function isNegativeDecimal(value: Decimal | string | number): boolean {
  return new Decimal(value).isNegative() && !new Decimal(value).isZero();
}
