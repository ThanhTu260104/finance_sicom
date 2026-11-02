import type { AccountingHeaderMatch } from '@/lib/accounting-import/expected-columns';
import { excelColumnLabel } from '@/lib/accounting-import/read-accounting-workbook';

/** File mẫu kế toán công ty — cột cố định (0-based), dùng khi header không khớp. */
export const ACCOUNTING_STANDARD_COLUMN_INDEX: Record<string, number> = {
  invoiceNo: 3, // D — số hóa đơn
  periodFrom: 5, // F — từ ngày
  periodTo: 6, // G — đến ngày
  invoiceDate: 7, // H — ngày hóa đơn
  batchNo: 17, // R — đợt
};

export function mergeStandardAccountingColumns(
  matches: AccountingHeaderMatch[],
  columnCount: number,
): AccountingHeaderMatch[] {
  return matches.map((m: AccountingHeaderMatch) => {
    if (m.columnIndex >= 0) return m;
    const fixed = ACCOUNTING_STANDARD_COLUMN_INDEX[m.key];
    if (fixed == null || fixed >= columnCount) return m;
    return {
      ...m,
      columnIndex: fixed,
      columnLetter: excelColumnLabel(fixed),
      headerText: `(cột ${excelColumnLabel(fixed)} — mẫu chuẩn)`,
    };
  });
}
