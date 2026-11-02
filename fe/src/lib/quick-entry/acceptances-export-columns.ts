import {
  ACCEPTANCE_PAYMENT_STATUSES,
  DOCUMENT_STATUSES,
} from '@/lib/types';
import {
  acceptancePaymentStatusLabel,
  documentStatusLabel,
} from '@/components/shared/status-badges';
import type { CsvColumn } from '@/components/shared/csv-data-transfer';

export const ACCEPTANCES_BULK_EXPORT_COLUMNS: readonly CsvColumn[] = [
  {
    key: 'contractNo',
    header: 'SoHopDong',
    aliases: ['Số hợp đồng', 'contractNo'],
    required: true,
  },
  {
    key: 'projectCode',
    header: 'MaDuAn',
    aliases: ['Mã dự án', 'projectCode'],
  },
  {
    key: 'contractName',
    header: 'TenHopDong',
    aliases: ['Tên hợp đồng'],
  },
  {
    key: 'acceptanceNo',
    header: 'SoDot',
    aliases: ['acceptanceNo', 'Ký hiệu NT'],
    required: true,
  },
  {
    key: 'period',
    header: 'Ky',
    aliases: ['period', 'Kỳ'],
    required: true,
  },
  {
    key: 'amount',
    header: 'SoTien',
    aliases: ['amount', 'Số tiền'],
    required: true,
  },
  {
    key: 'acceptanceDate',
    header: 'NgayNT',
    aliases: ['acceptanceDate', 'Ngày NT'],
  },
  {
    key: 'invoiceNo',
    header: 'SoHoaDon',
    aliases: ['invoiceNo', 'Số HĐ'],
  },
  {
    key: 'invoiceDate',
    header: 'NgayHoaDon',
    aliases: ['invoiceDate', 'Ngày HĐ'],
  },
  {
    key: 'documentStatus',
    header: 'HoSo',
    aliases: ['documentStatus', 'Hồ sơ'],
    type: 'select',
    options: DOCUMENT_STATUSES.map((s) => ({
      value: s,
      label: documentStatusLabel[s],
    })),
  },
  {
    key: 'paymentStatus',
    header: 'ThanhToan',
    aliases: ['paymentStatus', 'Thanh toán'],
    type: 'select',
    options: ACCEPTANCE_PAYMENT_STATUSES.map((s) => ({
      value: s,
      label: acceptancePaymentStatusLabel[s],
    })),
  },
  {
    key: 'note',
    header: 'GhiChu',
    aliases: ['note', 'Ghi chú'],
  },
];
