'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { ContractKind, PartnerType } from '@/lib/types';
import { CONTRACT_KINDS } from '@/lib/types';

export const partnerTypeLabel: Record<PartnerType, string> = {
  INVESTOR: 'Chủ đầu tư',
  SUBCONTRACTOR: 'Thầu phụ',
  SUPPLIER: 'Nhà cung cấp',
};

export const contractKindLabel: Record<ContractKind, string> = {
  INVESTOR: 'HĐ Chủ đầu tư',
  SUBCONTRACTOR: 'HĐ Thầu phụ',
  SUPPLIER: 'HĐ Nhà cung cấp',
};

export function isExpenseContractKind(kind: ContractKind) {
  return kind !== 'INVESTOR';
}

/** Đọc `?kind=` trên URL; sai / thiếu → INVESTOR */
export function parseContractKind(value: string | null | undefined): ContractKind {
  return (CONTRACT_KINDS as readonly string[]).includes(value ?? '')
    ? (value as ContractKind)
    : 'INVESTOR';
}

export function contractListHref(kind: ContractKind) {
  return kind === 'INVESTOR' ? '/contracts' : `/contracts?kind=${kind}`;
}

/**
 * Nhãn dòng tiền theo chiều HĐ. HĐ CĐT: thu tiền / phải thu.
 * HĐ thầu phụ / NCC: chi trả / phải trả. Bản ghi vẫn dùng chung bảng
 * collections + acceptances, chỉ đổi cách gọi trên giao diện.
 */
export type ContractFlowLabels = {
  kind: ContractKind;
  counterpartyRole: string;
  cashFlow: string;
  cashFlowLower: string;
  cashed: string;
  cashedFull: string;
  outstanding: string;
  waitingPayment: string;
  cashRate: string;
  /** Tab / tiêu đề kế hoạch */
  planTitle: string;
  /** Tab / tiêu đề nghiệm thu */
  acceptanceTitle: string;
  acceptanceAdd: string;
  /** Một dòng giải thích chiều nghiệm thu → tiền */
  acceptanceIntro: string;
  /** Trạng thái hồ sơ NOT_SUBMITTED / SUBMITTED_UNPAID */
  docNotSubmitted: string;
  docSubmitted: string;
  /** Cột tuổi nợ / hạn trả */
  agingTitle: string;
  /** "Đã nghiệm thu" ở KPI */
  accepted: string;
  /** Gợi ý điều khoản thanh toán trên form HĐ */
  paymentTermHint: string;
};

const EXPENSE_COMMON = {
  cashFlow: 'Chi trả',
  cashFlowLower: 'chi trả',
  cashed: 'Đã chi',
  cashedFull: 'Đã chi trả',
  outstanding: 'Còn phải trả',
  cashRate: 'Chi trả so với đã nghiệm thu',
  planTitle: 'Kế hoạch nghiệm thu & thanh toán',
  docNotSubmitted: 'Chưa nhận hồ sơ',
  docSubmitted: 'Đã nhận HS - chưa trả',
  agingTitle: 'Hạn phải trả',
  paymentTermHint: 'Hạn phải trả = ngày hóa đơn của đối tác + số ngày này',
} as const;

const FLOW_LABELS: Record<ContractKind, ContractFlowLabels> = {
  INVESTOR: {
    kind: 'INVESTOR',
    counterpartyRole: 'Chủ đầu tư',
    cashFlow: 'Thu tiền',
    cashFlowLower: 'thu tiền',
    cashed: 'Đã thu',
    cashedFull: 'Đã thu tiền',
    outstanding: 'Còn phải thu',
    waitingPayment: 'Chờ CĐT thanh toán',
    cashRate: 'Thu tiền so với đã nghiệm thu',
    planTitle: 'Kế hoạch nghiệm thu',
    acceptanceTitle: 'Nghiệm thu',
    acceptanceAdd: 'Thêm nghiệm thu',
    acceptanceIntro:
      'Mình nộp hồ sơ nghiệm thu cho chủ đầu tư → CĐT thanh toán. Khi CĐT trả tiền, chọn "Đã thu tiền" — hệ thống tự ghi nhận khoản thu.',
    docNotSubmitted: 'Chưa nộp',
    docSubmitted: 'Đã nộp - tiền chưa về',
    agingTitle: 'Tuổi nợ',
    accepted: 'Đã nghiệm thu',
    paymentTermHint: 'Tuổi nợ = ngày hóa đơn + số ngày này',
  },
  SUBCONTRACTOR: {
    kind: 'SUBCONTRACTOR',
    counterpartyRole: 'Thầu phụ',
    ...EXPENSE_COMMON,
    waitingPayment: 'Chờ mình thanh toán',
    acceptanceTitle: 'Nghiệm thu khối lượng',
    acceptanceAdd: 'Ghi nhận nghiệm thu',
    acceptanceIntro:
      'Thầu phụ gửi hồ sơ nghiệm thu khối lượng → mình xác nhận và thanh toán. Khi mình trả tiền, chọn "Đã chi trả" — hệ thống tự ghi nhận khoản chi (tính vào chi phí dự án).',
    accepted: 'Đã nghiệm thu cho thầu phụ',
  },
  SUPPLIER: {
    kind: 'SUPPLIER',
    counterpartyRole: 'Nhà cung cấp',
    ...EXPENSE_COMMON,
    waitingPayment: 'Chờ mình thanh toán',
    acceptanceTitle: 'Nghiệm thu giao hàng',
    acceptanceAdd: 'Ghi nhận giao hàng',
    acceptanceIntro:
      'NCC giao hàng và gửi hồ sơ → mình nghiệm thu hàng và thanh toán. Khi mình trả tiền, chọn "Đã chi trả" — hệ thống tự ghi nhận khoản chi (tính vào chi phí dự án).',
    accepted: 'Đã nghiệm thu hàng',
  },
};

export function contractFlowLabels(kind: ContractKind) {
  return FLOW_LABELS[kind];
}

const ContractKindContext = createContext<ContractKind>('INVESTOR');

export function ContractKindProvider({
  kind,
  children,
}: {
  kind: ContractKind | null | undefined;
  children: ReactNode;
}) {
  return (
    <ContractKindContext.Provider value={kind ?? 'INVESTOR'}>
      {children}
    </ContractKindContext.Provider>
  );
}

/** Nhãn thu/chi của HĐ đang xem — mặc định CĐT khi không có provider */
export function useContractFlowLabels() {
  return FLOW_LABELS[useContext(ContractKindContext)];
}
