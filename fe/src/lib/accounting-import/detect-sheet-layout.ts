import { normAccountingHeader } from '@/lib/accounting-import/expected-columns';

function normalizeCell(value: string) {
  return normAccountingHeader(value);
}

/** Tìm dòng header kiểu bảng kế toán (STT + Số Hợp Đồng / Mã Dự Án). Trả về chỉ số 0-based. */
export function detectAccountingHeaderRow(
  matrix: string[][],
  maxScan = 20,
): number {
  for (let i = 0; i < Math.min(maxScan, matrix.length); i++) {
    const cells = (matrix[i] ?? []).map((c) => normalizeCell(String(c ?? '')));
    const first = cells[0] ?? '';
    const hasStt = first === 'stt' || first === 'tt';
    const rowText = cells.join(' ');
    const hasContract =
      rowText.includes('so hop dong') ||
      rowText.includes('hop dong') ||
      rowText.includes('ma du an');
    const hasInvoice =
      rowText.includes('hoa don') || rowText.includes('thanh tien');
    if (hasStt && (hasContract || hasInvoice)) return i;
  }
  return matrix.length > 1 ? 1 : 0;
}

/** Gợi ý dòng bắt đầu data = ngay sau header (1-based Excel row). */
export function suggestDataStartExcelRow(headerRowIndex0: number): number {
  return headerRowIndex0 + 2;
}

export function suggestHeaderExcelRow(headerRowIndex0: number): number {
  return headerRowIndex0 + 1;
}
