import { normalizeAmount } from '@/lib/csv';
import type { AcceptancePayload } from '@/lib/api/finance';

function toIsoDate(value?: string) {
  const v = value?.trim();
  if (!v) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    return new Date(`${v}T00:00:00.000Z`).toISOString();
  }
  return new Date(v).toISOString();
}

export function normalizeDocumentStatus(value: string) {
  const raw = value.trim().toUpperCase();
  if (!raw) return 'NOT_SUBMITTED' as const;
  if (
    raw === 'NOT_SUBMITTED' ||
    raw === 'CHUA_NOP' ||
    raw.includes('CHUA')
  ) {
    return 'NOT_SUBMITTED' as const;
  }
  if (
    raw === 'SUBMITTED_UNPAID' ||
    raw === 'DA_NOP' ||
    raw.includes('NOP')
  ) {
    return 'SUBMITTED_UNPAID' as const;
  }
  return null;
}

export function normalizePaymentStatus(value: string, documentStatus: string) {
  if (documentStatus === 'NOT_SUBMITTED') return 'NOT_ACCEPTED' as const;
  const raw = value.trim().toUpperCase();
  if (!raw || raw === 'WAITING_CLIENT_PAYMENT' || raw === 'CHO_THANH_TOAN') {
    return 'WAITING_CLIENT_PAYMENT' as const;
  }
  if (raw === 'COLLECTED' || raw === 'DA_THU') {
    return 'COLLECTED' as const;
  }
  if (raw === 'NOT_ACCEPTED' || raw === 'CHUA_NT') return 'NOT_ACCEPTED' as const;
  return null;
}

export function mapAcceptanceImportRow(
  row: Record<string, string>,
): AcceptancePayload {
  const documentStatus =
    normalizeDocumentStatus(row.documentStatus ?? '') ?? 'NOT_SUBMITTED';
  const paymentStatus =
    normalizePaymentStatus(row.paymentStatus ?? '', documentStatus) ??
    (documentStatus === 'NOT_SUBMITTED'
      ? 'NOT_ACCEPTED'
      : 'WAITING_CLIENT_PAYMENT');
  return {
    acceptanceNo: row.acceptanceNo.trim(),
    period: row.period.trim(),
    amount: Number(normalizeAmount(row.amount)),
    acceptanceDate: toIsoDate(row.acceptanceDate),
    invoiceNo: row.invoiceNo?.trim() || undefined,
    invoiceDate: toIsoDate(row.invoiceDate),
    documentStatus,
    paymentStatus,
    note: row.note?.trim() || undefined,
  };
}
