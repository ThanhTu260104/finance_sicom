import type { CsvColumn } from '@/components/shared/csv-data-transfer';
import { buildPeriodOptions } from '@/components/shared/csv-data-transfer';
import {
  acceptancePaymentStatusLabel,
  documentStatusLabel,
} from '@/components/shared/status-badges';
import { ACCEPTANCE_PAYMENT_STATUSES, DOCUMENT_STATUSES } from '@/lib/types';

const PERIOD_OPTIONS = buildPeriodOptions();

export const QUICK_ACCEPTANCE_COLUMNS: readonly CsvColumn[] = [
  {
    key: 'acceptanceNo',
    header: 'SoDot',
    aliases: ['acceptanceNo', 'Số đợt', 'dot'],
    required: true,
    sample: 'Đợt 01/2026',
  },
  {
    key: 'period',
    header: 'Ky',
    aliases: ['period', 'Kỳ', 'ky'],
    required: true,
    sample: '2026-01',
    type: 'period',
    options: PERIOD_OPTIONS,
  },
  {
    key: 'amount',
    header: 'SoTien',
    aliases: ['amount', 'Số tiền'],
    required: true,
    sample: '500000000',
    type: 'money',
  },
  {
    key: 'acceptanceDate',
    header: 'NgayNT',
    aliases: ['acceptanceDate', 'Ngày NT'],
    sample: '2026-01-28',
    type: 'date',
  },
  {
    key: 'invoiceNo',
    header: 'SoHoaDon',
    aliases: ['invoiceNo', 'Số HĐ'],
    sample: 'HD-01/2026',
  },
  {
    key: 'documentStatus',
    header: 'HoSo',
    aliases: ['documentStatus', 'Hồ sơ'],
    sample: 'SUBMITTED_UNPAID',
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
    sample: 'WAITING_CLIENT_PAYMENT',
    type: 'select',
    options: ACCEPTANCE_PAYMENT_STATUSES.map((s) => ({
      value: s,
      label: acceptancePaymentStatusLabel[s],
    })),
  },
  { key: 'note', header: 'GhiChu', aliases: ['note'], sample: '' },
];

export const QUICK_COLLECTION_COLUMNS: readonly CsvColumn[] = [
  {
    key: 'collectionNo',
    header: 'SoChungTu',
    aliases: ['collectionNo', 'Số chứng từ'],
    required: true,
    sample: 'TT-01/2026',
  },
  {
    key: 'period',
    header: 'Ky',
    aliases: ['period', 'Kỳ'],
    required: true,
    sample: '2026-01',
    type: 'period',
    options: PERIOD_OPTIONS,
  },
  {
    key: 'amount',
    header: 'SoTien',
    aliases: ['amount', 'Số tiền'],
    required: true,
    sample: '500000000',
    type: 'money',
  },
  {
    key: 'collectionDate',
    header: 'NgayThu',
    aliases: ['collectionDate', 'Ngày thu'],
    sample: '2026-02-15',
    type: 'date',
  },
  { key: 'note', header: 'GhiChu', aliases: ['note'], sample: '' },
];

export { REVENUE_PLAN_CSV_COLUMNS as QUICK_PLAN_COLUMNS } from '@/lib/revenue-plan-csv';
