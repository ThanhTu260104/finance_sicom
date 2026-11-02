import { mergeStandardAccountingColumns } from '@/lib/accounting-import/fixed-column-layout';
import { excelColumnLabel } from '@/lib/accounting-import/read-accounting-workbook';

/** Cột chuẩn file kế toán NT/thu — dùng đối chiếu khi xác nhận import */
export const ACCOUNTING_FIELD_LABELS: Record<string, string> = {
  stt: 'STT',
  company: 'Công ty',
  contractSymbol: 'Ký hiệu HĐ',
  invoiceNo: 'Số hóa đơn',
  periodFrom: 'Từ ngày (đợt NT)',
  periodTo: 'Đến ngày (đợt NT)',
  batchNo: 'Đợt NT',
  invoiceDate: 'Ngày hóa đơn',
  monthLabel: 'Tháng (nhãn)',
  projectCode: 'Mã dự án',
  projectName: 'Tên dự án',
  contractNo: 'Số hợp đồng',
  detail: 'Chi tiết nghiệp vụ',
  amountBeforeTax: 'Thành tiền (trước thuế)',
  vat: 'Tiền thuế GTGT',
  amountTotal: 'Tổng thành tiền',
  paymentStatus: 'Tình trạng thanh toán',
  collectedAmount: 'Tiền thu',
  paymentDate: 'Ngày thanh toán',
};

export const ACCOUNTING_ACCEPTANCE_FIELDS = [
  { key: 'stt', labels: ['stt'] },
  { key: 'company', labels: ['cong ty', 'công ty'] },
  { key: 'contractSymbol', labels: ['ky hieu hd', 'ký hiệu hđ'] },
  { key: 'invoiceNo', labels: ['so hoa don', 'số hóa đơn'] },
  { key: 'periodFrom', labels: ['tu ngay', 'từ ngày'] },
  { key: 'periodTo', labels: ['den ngay', 'đến ngày'] },
  { key: 'batchNo', labels: ['dot nt', 'đợt nt', 'dot', 'đợt'] },
  { key: 'invoiceDate', labels: ['ngay hoa don', 'ngày hóa đơn'] },
  { key: 'monthLabel', labels: ['thang', 'tháng'] },
  { key: 'projectCode', labels: ['ma du an', 'mã dự án'] },
  { key: 'projectName', labels: ['ten du an', 'tên dự án'] },
  { key: 'contractNo', labels: ['so hop dong', 'số hợp đồng'] },
  { key: 'detail', labels: ['chi tiet nghiep vu', 'chi tiết nghiệp vụ'] },
  { key: 'amountBeforeTax', labels: ['thanh tien', 'thành tiền'] },
  { key: 'vat', labels: ['tien thue gtgt', 'tiền thuế gtgt'] },
  { key: 'amountTotal', labels: ['tong thanh tien', 'tổng thành tiền'] },
  {
    key: 'paymentStatus',
    labels: ['tinh trang thanh toan', 'tình trạng thanh toán'],
  },
  { key: 'collectedAmount', labels: ['tien thu', 'tiền thu'] },
  { key: 'paymentDate', labels: ['ngay thanh toan', 'ngày thanh toán'] },
] as const;

/** Chuẩn hóa header Excel (tiếng Việt, gồm đ/Đ → d) để so khớp nhãn cột */
export function normAccountingHeader(h: string) {
  return h
    .trim()
    .toLowerCase()
    .replace(/đ/g, 'd')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ');
}

function normLabel(label: string) {
  return normAccountingHeader(label);
}

function headerMatchesField(headerNorm: string, label: string) {
  const needle = normLabel(label);
  if (needle.includes('tong thanh')) {
    return headerNorm.includes('tong') && headerNorm.includes('thanh');
  }
  if (needle === 'thanh tien') {
    return headerNorm === 'thanh tien' || headerNorm.startsWith('thanh tien ');
  }
  if (needle === 'thang') {
    return headerNorm === 'thang';
  }
  return headerNorm === needle || headerNorm.includes(needle);
}

export type AccountingHeaderMatch = {
  key: string;
  columnIndex: number;
  columnLetter: string | null;
  headerText: string | null;
};

/** Gán mỗi cột file tối đa một trường — ưu tiên nhãn dài (Tổng thành tiền trước Thành tiền). */
export function matchAccountingHeaders(
  headers: string[],
): AccountingHeaderMatch[] {
  const normalized = headers.map((h) => normAccountingHeader(h));
  const used = new Set<number>();
  const sorted = [...ACCOUNTING_ACCEPTANCE_FIELDS].sort(
    (a, b) =>
      Math.max(...b.labels.map((l) => l.length)) -
      Math.max(...a.labels.map((l) => l.length)),
  );
  const byKey = new Map<
    string,
    { columnIndex: number; columnLetter: string; headerText: string }
  >();

  for (const field of sorted) {
    const idx = normalized.findIndex((n, i) => {
      if (used.has(i)) return false;
      return field.labels.some((l) => headerMatchesField(n, l));
    });
    if (idx >= 0) {
      used.add(idx);
      byKey.set(field.key, {
        columnIndex: idx,
        columnLetter: excelColumnLabel(idx),
        headerText: headers[idx] ?? '',
      });
    }
  }

  const mapped = ACCOUNTING_ACCEPTANCE_FIELDS.map((field) => {
    const hit = byKey.get(field.key);
    return {
      key: field.key,
      columnIndex: hit?.columnIndex ?? -1,
      columnLetter: hit?.columnLetter ?? null,
      headerText: hit?.headerText ?? null,
    };
  });
  return mergeStandardAccountingColumns(mapped, headers.length);
}
