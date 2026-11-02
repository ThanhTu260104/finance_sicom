import type { CsvColumn } from '@/components/shared/csv-data-transfer';
import type { MaintenanceDailyGridContract } from '@/lib/api/contracts';

export const MAINTENANCE_DAILY_CSV_COLUMNS: readonly CsvColumn[] = [
  {
    key: 'period',
    header: 'Kỳ tháng',
    aliases: ['Ky thang', 'period'],
    required: true,
    type: 'period',
    sample: '2026-10',
  },
  {
    key: 'projectCode',
    header: 'Mã dự án',
    aliases: ['Ma du an', 'projectCode'],
    required: true,
    sample: 'DA01',
  },
  {
    key: 'contractNo',
    header: 'Số HĐ',
    aliases: ['So HD', 'contractNo'],
    required: true,
    sample: 'HD-2026-001',
  },
  {
    key: 'contractName',
    header: 'Tên HĐ',
    aliases: ['Ten HD'],
    required: false,
    sample: 'Hợp đồng bảo trì …',
  },
  {
    key: 'workDate',
    header: 'Ngày',
    aliases: ['Ngay', 'workDate'],
    required: true,
    type: 'date',
    sample: '2026-10-09',
  },
  {
    key: 'amount',
    header: 'Số tiền',
    aliases: ['So tien', 'amount'],
    required: true,
    type: 'money',
    sample: '1250000',
  },
];

export function buildMaintenanceDailyExportRows(input: {
  period: string;
  workDates: string[];
  contracts: MaintenanceDailyGridContract[];
  amounts: Record<string, string>;
  onlyNonZero?: boolean;
}): Array<Record<string, string>> {
  const rows: Array<Record<string, string>> = [];
  for (const c of input.contracts) {
    for (const workDate of input.workDates) {
      const key = `${c.id}|${workDate}`;
      const raw = input.amounts[key] ?? '0';
      const n = Number(raw);
      if (input.onlyNonZero && (!Number.isFinite(n) || n === 0)) continue;
      rows.push({
        period: input.period,
        projectCode: c.project.code,
        contractNo: c.contractNo,
        contractName: c.name,
        workDate,
        amount: raw,
      });
    }
  }
  return rows;
}
