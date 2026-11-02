import type { CsvColumn } from '@/components/shared/csv-data-transfer';
import { buildPeriodOptions } from '@/components/shared/csv-data-transfer';
import {
  isValidAmount,
  isValidOptionalDate,
  isValidPeriod,
  normalizeAmount,
} from '@/lib/csv';
import { periodFromDateYmd } from '@/lib/acceptance-plan-periods';
import type { RevenuePlanPayload } from '@/lib/api/finance';

const PERIOD_OPTIONS = buildPeriodOptions();

/** Cột mẫu Excel — kế hoạch NT theo đợt + khoảng ngày */
export const REVENUE_PLAN_CSV_COLUMNS: readonly CsvColumn[] = [
  {
    key: 'batchSequence',
    header: 'DotNT',
    aliases: ['batchSequence', 'Dot NT', 'Số đợt', 'So dot', 'dot', 'Đợt'],
    required: true,
    sample: '1',
  },
  {
    key: 'periodStartDate',
    header: 'TuNgay',
    aliases: ['periodStartDate', 'Từ ngày', 'Tu ngay', 'tu ngay'],
    required: true,
    sample: '2026-07-10',
    type: 'date',
  },
  {
    key: 'periodEndDate',
    header: 'DenNgay',
    aliases: ['periodEndDate', 'Đến ngày', 'Den ngay', 'den ngay'],
    required: true,
    sample: '2026-09-30',
    type: 'date',
  },
  {
    key: 'period',
    header: 'Ky',
    aliases: ['period', 'Kỳ', 'ky', 'Ky bao cao'],
    sample: '2026-09',
    type: 'period',
    options: PERIOD_OPTIONS,
  },
  {
    key: 'plannedAmount',
    header: 'KeHoach',
    aliases: ['plannedAmount', 'Kế hoạch', 'Ke hoach', 'amount'],
    required: true,
    sample: '625000000',
    type: 'money',
  },
  {
    key: 'plannedAcceptanceDate',
    header: 'NgayNTDuKien',
    aliases: [
      'plannedAcceptanceDate',
      'Ngay NT du kien',
      'Ngày NT dự kiến',
    ],
    sample: '2026-09-28',
    type: 'date',
  },
  {
    key: 'note',
    header: 'GhiChu',
    aliases: ['note', 'Ghi chú'],
    sample: 'Đợt 1 — quý III',
  },
];

export const REVENUE_PLAN_BULK_CSV_COLUMNS: readonly CsvColumn[] = [
  {
    key: 'contractNo',
    header: 'SoHopDong',
    aliases: ['contractNo', 'Số HĐ', 'So HD', 'so hop dong'],
    required: true,
    sample: 'HĐ-2026-001',
  },
  ...REVENUE_PLAN_CSV_COLUMNS,
];

export const REVENUE_PLAN_CSV_SAMPLE_ROWS: Array<Record<string, string>> = [
  {
    batchSequence: '1',
    periodStartDate: '2026-07-10',
    periodEndDate: '2026-09-30',
    period: '2026-09',
    plannedAmount: '500000000',
    plannedAcceptanceDate: '2026-09-28',
    note: 'Đợt 1',
  },
  {
    batchSequence: '2',
    periodStartDate: '2026-10-01',
    periodEndDate: '2026-12-31',
    period: '2026-12',
    plannedAmount: '500000000',
    plannedAcceptanceDate: '',
    note: 'Đợt 2',
  },
];

export function resolvePlanPeriodFromCsvRow(row: Record<string, string>): string {
  const fromPeriod = row.period?.trim();
  if (fromPeriod && isValidPeriod(fromPeriod)) return fromPeriod;
  const end = row.periodEndDate?.trim() ?? '';
  return periodFromDateYmd(end) ?? '';
}

export function validateRevenuePlanCsvRow(
  row: Record<string, string>,
): string[] {
  const errors: string[] = [];
  const batch = row.batchSequence?.trim();
  if (!batch || !/^\d+$/.test(batch) || Number(batch) < 1) {
    errors.push('Số đợt (DotNT) ≥ 1');
  }
  if (!row.periodStartDate?.trim()) {
    errors.push('Thiếu Từ ngày (TuNgay)');
  } else if (!isValidOptionalDate(row.periodStartDate)) {
    errors.push('Từ ngày YYYY-MM-DD');
  }
  if (!row.periodEndDate?.trim()) {
    errors.push('Thiếu Đến ngày (DenNgay)');
  } else if (!isValidOptionalDate(row.periodEndDate)) {
    errors.push('Đến ngày YYYY-MM-DD');
  }
  if (
    row.periodStartDate?.trim() &&
    row.periodEndDate?.trim() &&
    row.periodStartDate.trim() > row.periodEndDate.trim()
  ) {
    errors.push('Từ ngày phải ≤ đến ngày');
  }
  const period = resolvePlanPeriodFromCsvRow(row);
  if (!period || !isValidPeriod(period)) {
    errors.push('Kỳ YYYY-MM (Ky) hoặc đủ Đến ngày để suy kỳ');
  }
  if (!isValidAmount(row.plannedAmount ?? '')) {
    errors.push('Số tiền kế hoạch không hợp lệ');
  }
  if (
    row.plannedAcceptanceDate?.trim() &&
    !isValidOptionalDate(row.plannedAcceptanceDate)
  ) {
    errors.push('Ngày NT dự kiến YYYY-MM-DD');
  }
  return errors;
}

export function revenuePlanCsvRowToPayload(
  row: Record<string, string>,
): RevenuePlanPayload {
  const period = resolvePlanPeriodFromCsvRow(row);
  return {
    batchSequence: Number(row.batchSequence!.trim()),
    periodStartDate: row.periodStartDate!.trim(),
    periodEndDate: row.periodEndDate!.trim(),
    period,
    plannedAmount: Number(normalizeAmount(row.plannedAmount!)),
    plannedAcceptanceDate: row.plannedAcceptanceDate?.trim() || undefined,
    note: row.note?.trim() || undefined,
  };
}

export function revenuePlanToCsvRow(p: {
  batchSequence?: number | null;
  periodStartDate?: string | null;
  periodEndDate?: string | null;
  period: string;
  plannedAmount: string | number;
  plannedAcceptanceDate?: string | null;
  note?: string | null;
}): Record<string, string> {
  return {
    batchSequence: p.batchSequence != null ? String(p.batchSequence) : '',
    periodStartDate: p.periodStartDate?.slice(0, 10) ?? '',
    periodEndDate: p.periodEndDate?.slice(0, 10) ?? '',
    period: p.period,
    plannedAmount: String(p.plannedAmount),
    plannedAcceptanceDate: p.plannedAcceptanceDate?.slice(0, 10) ?? '',
    note: p.note ?? '',
  };
}
