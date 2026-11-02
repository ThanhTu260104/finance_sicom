import {
  normalizeBatchAcceptanceNo,
  periodFromDateYmd,
} from '@/lib/acceptance-plan-periods';
import { isValidPeriod } from '@/lib/csv';
import { parseGroupedNumber } from '@/lib/number-format';
import {
  matchAccountingHeaders,
  type AccountingHeaderMatch,
} from '@/lib/accounting-import/expected-columns';
import { normalizeContractNo } from '@/lib/accounting-import/normalize-contract-no';
import {
  accountingDateToIso,
  parseAccountingDate,
} from '@/lib/accounting-import/parse-accounting-date';

export type AccountingImportPayload = {
  contractNo: string;
  projectCode?: string;
  acceptanceNo: string;
  period: string;
  amount: number;
  acceptanceDate?: string;
  invoiceNo?: string;
  invoiceDate?: string;
  documentStatus: 'NOT_SUBMITTED' | 'SUBMITTED_UNPAID';
  paymentStatus: 'NOT_ACCEPTED' | 'WAITING_CLIENT_PAYMENT' | 'COLLECTED';
  note?: string;
};

export type MappedAccountingRow = {
  excelRow: number;
  payload?: AccountingImportPayload;
  errors: string[];
  warnings: string[];
  skipped?: boolean;
  skipReason?: string;
};

function colValue(
  row: string[],
  matches: AccountingHeaderMatch[],
  key: string,
) {
  const m = matches.find((x: AccountingHeaderMatch) => x.key === key);
  if (!m || m.columnIndex < 0) return '';
  return (row[m.columnIndex] ?? '').trim();
}

function parseMoney(raw: string) {
  const n = parseGroupedNumber(raw);
  if (!n || !/^\d+(\.\d{1,2})?$/.test(n)) return null;
  const v = Number(n);
  return Number.isFinite(v) && v >= 0 ? v : null;
}

function parseMonthFromLabel(label: string): number | null {
  const m = /th[aá]ng\s*(\d{1,2})/i.exec(label);
  if (!m) return null;
  const month = Number(m[1]);
  return month >= 1 && month <= 12 ? month : null;
}

function resolvePeriod(
  monthLabel: string,
  invoiceDateYmd: string,
  periodToYmd: string,
  periodFromYmd: string,
): string {
  const fromTo = periodToYmd
    ? periodFromDateYmd(periodToYmd)
    : periodFromYmd
      ? periodFromDateYmd(periodFromYmd)
      : null;
  if (fromTo) return fromTo;

  let year = new Date().getUTCFullYear();
  let month = new Date().getUTCMonth() + 1;

  if (invoiceDateYmd) {
    const parts = invoiceDateYmd.split('-');
    if (parts.length === 3) {
      year = Number(parts[0]);
      month = Number(parts[1]);
    }
  }

  const fromLabel = parseMonthFromLabel(monthLabel);
  if (fromLabel != null) month = fromLabel;

  return `${year}-${String(month).padStart(2, '0')}`;
}

function acceptanceNoFromRow(
  batchNo: string,
  symbol: string,
  invoiceNo: string,
  detail: string,
): string | null {
  const fromBatch = normalizeBatchAcceptanceNo(batchNo);
  if (fromBatch) return fromBatch;
  if (symbol) return symbol;
  if (invoiceNo) return `HD-${invoiceNo}`;
  const dot = /(?:^|\s)[ĐD]ợt\s*(\d+)/i.exec(detail);
  if (dot) return `Đợt ${dot[1]}`;
  return null;
}

function paymentFromAccounting(
  statusText: string,
  collectedRaw: string,
  amount: number,
): 'WAITING_CLIENT_PAYMENT' | 'COLLECTED' {
  const norm = statusText
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
  const collected = parseMoney(collectedRaw);
  if (norm.includes('da thu') && collected != null && collected > 0) {
    return 'COLLECTED';
  }
  if (collected != null && amount > 0 && collected >= amount) {
    return 'COLLECTED';
  }
  return 'WAITING_CLIENT_PAYMENT';
}

type MapOptions = {
  dataStartExcelRow: number;
  /** Chỉ import dòng thuộc Số HĐ này (nhập từ trang hợp đồng) */
  onlyContractNo?: string;
};

export function mapAccountingRows(
  headers: string[],
  rows: string[][],
  options: MapOptions,
): MappedAccountingRow[] {
  const matches = matchAccountingHeaders(headers);
  const onlyNorm = options.onlyContractNo
    ? normalizeContractNo(options.onlyContractNo)
    : null;

  return rows.map((row, index) => {
    const excelRow = options.dataStartExcelRow + index;
    const errors: string[] = [];
    const warnings: string[] = [];

    const contractNo = colValue(row, matches, 'contractNo');
    if (!contractNo) errors.push('Thiếu Số Hợp Đồng');

    if (onlyNorm && contractNo) {
      if (normalizeContractNo(contractNo) !== onlyNorm) {
        return {
          excelRow,
          errors: [],
          warnings: [],
          skipped: true,
          skipReason: 'Không thuộc hợp đồng đang mở',
        };
      }
    }

    const projectCode = colValue(row, matches, 'projectCode') || undefined;
    const symbol = colValue(row, matches, 'contractSymbol');
    const invoiceNo = colValue(row, matches, 'invoiceNo');
    const batchNo = colValue(row, matches, 'batchNo');
    const detail = colValue(row, matches, 'detail');

    const acceptanceNo = acceptanceNoFromRow(
      batchNo,
      symbol,
      invoiceNo,
      detail,
    );
    if (!acceptanceNo) errors.push('Thiếu cột Đợt (R) / Ký hiệu HĐ / Số Hóa đơn');

    const amount = parseMoney(colValue(row, matches, 'amountTotal'));
    if (amount == null) errors.push('Tổng thành tiền không hợp lệ');

    const periodToYmd = parseAccountingDate(colValue(row, matches, 'periodTo'));
    const periodFromYmd = parseAccountingDate(
      colValue(row, matches, 'periodFrom'),
    );
    const invoiceDateYmd = parseAccountingDate(
      colValue(row, matches, 'invoiceDate'),
    );
    const period = resolvePeriod(
      colValue(row, matches, 'monthLabel'),
      invoiceDateYmd,
      periodToYmd,
      periodFromYmd,
    );
    if (!isValidPeriod(period)) errors.push(`Kỳ không hợp lệ: ${period}`);

    const paymentStatus =
      amount != null
        ? paymentFromAccounting(
            colValue(row, matches, 'paymentStatus'),
            colValue(row, matches, 'collectedAmount'),
            amount,
          )
        : 'WAITING_CLIENT_PAYMENT';

    const documentStatus = invoiceNo || invoiceDateYmd
      ? ('SUBMITTED_UNPAID' as const)
      : ('SUBMITTED_UNPAID' as const);

    const noteRaw = detail.slice(0, 2000);

    if (errors.length > 0) {
      return { excelRow, errors, warnings };
    }

    const payload: AccountingImportPayload = {
      contractNo,
      projectCode,
      acceptanceNo: acceptanceNo!,
      period,
      amount: amount!,
      acceptanceDate: accountingDateToIso(invoiceDateYmd),
      invoiceNo: invoiceNo || undefined,
      invoiceDate: accountingDateToIso(invoiceDateYmd),
      documentStatus,
      paymentStatus,
      note: noteRaw || undefined,
    };

    return { excelRow, payload, errors: [], warnings };
  });
}
