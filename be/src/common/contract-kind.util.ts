import { ContractKind, Prisma } from '@prisma/client';

export const CONTRACT_KIND_LABEL: Record<ContractKind, string> = {
  INVESTOR: 'chủ đầu tư',
  SUBCONTRACTOR: 'thầu phụ',
  SUPPLIER: 'nhà cung cấp',
};

/** HĐ chi tiền (thầu phụ / nhà cung cấp) — không tính vào doanh thu */
export function isExpenseContractKind(kind: ContractKind) {
  return kind !== ContractKind.INVESTOR;
}

/**
 * Bộ lọc HĐ doanh thu — dùng cho dashboard, công nợ phải thu, nộp báo cáo, bảo trì.
 * HĐ thầu phụ / NCC không được lẫn vào các số liệu thu.
 */
export const REVENUE_CONTRACT_WHERE = {
  kind: ContractKind.INVESTOR,
} satisfies Prisma.ContractWhereInput;
