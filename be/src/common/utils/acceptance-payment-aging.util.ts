import {
  AcceptancePaymentStatus,
  DocumentStatus,
  type Acceptance,
} from '@prisma/client';

function startOfDay(date: Date) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

export function addDaysUtc(date: Date, days: number) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

export function paymentDueDateFromInvoice(
  invoiceDate: Date | null | undefined,
  paymentTermDays: number,
): Date | null {
  if (!invoiceDate) return null;
  return addDaysUtc(startOfDay(invoiceDate), paymentTermDays);
}

function diffDays(from: Date, to: Date) {
  const ms = startOfDay(to).getTime() - startOfDay(from).getTime();
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

export type AcceptancePaymentAging = {
  agingDays: number | null;
  daysUntilDue: number | null;
};

export function computeAcceptancePaymentAging(
  row: Pick<
    Acceptance,
    'invoiceDate' | 'documentStatus' | 'paymentStatus'
  >,
  paymentTermDays: number,
  asOf: Date = new Date(),
): AcceptancePaymentAging {
  const paymentDueDate = paymentDueDateFromInvoice(
    row.invoiceDate,
    paymentTermDays,
  );

  let agingDays: number | null = null;
  let daysUntilDue: number | null = null;

  if (paymentDueDate) {
    const delta = diffDays(paymentDueDate, asOf);
    if (delta >= 0) {
      agingDays = delta;
      daysUntilDue = 0;
    } else {
      agingDays = 0;
      daysUntilDue = Math.abs(delta);
    }
  }

  if (
    row.documentStatus === DocumentStatus.NOT_SUBMITTED ||
    row.paymentStatus === AcceptancePaymentStatus.NOT_ACCEPTED
  ) {
    agingDays = null;
    daysUntilDue = null;
  }

  if (row.paymentStatus === AcceptancePaymentStatus.COLLECTED) {
    agingDays = 0;
    daysUntilDue = 0;
  }

  return { agingDays, daysUntilDue };
}

/** Ưu tiên quá hạn lâu nhất; nếu chưa quá hạn thì kỳ đến hạn gần nhất. */
export function mergeWorstAcceptancePaymentAging(
  prev: AcceptancePaymentAging | null,
  next: AcceptancePaymentAging,
): AcceptancePaymentAging {
  if (!prev) return next;
  const prevOver = prev.agingDays ?? 0;
  const nextOver = next.agingDays ?? 0;
  if (nextOver !== prevOver) {
    return nextOver > prevOver ? next : prev;
  }
  if (prev.agingDays == null && next.agingDays == null) {
    return { agingDays: null, daysUntilDue: null };
  }
  const prevDue = prev.daysUntilDue ?? Number.POSITIVE_INFINITY;
  const nextDue = next.daysUntilDue ?? Number.POSITIVE_INFINITY;
  return nextDue < prevDue ? next : prev;
}
