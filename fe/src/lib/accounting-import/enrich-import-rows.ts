import {
  resolvePeriodForAcceptanceDate,
  type ContractAcceptanceScheduleInput,
} from '@/lib/acceptance-plan-periods';
import type { MappedAccountingRow } from '@/lib/accounting-import/map-accounting-rows';
import { normalizeContractNo } from '@/lib/accounting-import/normalize-contract-no';
import type { BillingCycle } from '@/lib/types';

export type ContractImportLookupRow = {
  contractNo: string;
  projectCode: string | null;
  startDate?: string | null;
  durationYears?: number | null;
  billingCycle?: BillingCycle;
};

export function buildContractLookupIndex(rows: ContractImportLookupRow[]) {
  const map = new Map<string, ContractImportLookupRow>();
  for (const row of rows) {
    map.set(normalizeContractNo(row.contractNo), row);
  }
  return map;
}

const ERR_NO_CONTRACT = 'Không tìm thấy Số HĐ trong hệ thống';
const ERR_DUP_IN_FILE = 'Trùng Số HĐ + mã NT trong cùng file';

export function enrichAccountingImportRows(
  mapped: MappedAccountingRow[],
  contractLookup: Map<string, ContractImportLookupRow>,
): MappedAccountingRow[] {
  const seenInFile = new Set<string>();

  return mapped.map((row) => {
    if (row.skipped || !row.payload) return row;

    const errors = [...row.errors];
    const warnings = [...row.warnings];
    const { contractNo, projectCode, acceptanceNo } = row.payload;

    const norm = normalizeContractNo(contractNo);
    const hit = contractLookup.get(norm);
    if (!hit) {
      errors.push(ERR_NO_CONTRACT);
    } else if (projectCode?.trim() && hit.projectCode) {
      const fromFile = projectCode.trim().toLowerCase();
      const inDb = hit.projectCode.trim().toLowerCase();
      if (fromFile !== inDb) {
        warnings.push(
          `Mã DA file (${projectCode}) khác DB (${hit.projectCode})`,
        );
      }
    }

    const dupKey = `${norm}|${acceptanceNo.trim().toLowerCase()}`;
    if (seenInFile.has(dupKey)) {
      errors.push(ERR_DUP_IN_FILE);
    } else {
      seenInFile.add(dupKey);
    }

    let payload = row.payload;
    if (hit && payload && errors.length === row.errors.length) {
      const meta: ContractAcceptanceScheduleInput = {
        startDate: hit.startDate,
        durationYears: hit.durationYears,
        billingCycle: hit.billingCycle ?? 'MONTHLY',
      };
      const dateForPeriod =
        payload.invoiceDate?.slice(0, 10) ??
        payload.acceptanceDate?.slice(0, 10);
      if (dateForPeriod) {
        const resolved = resolvePeriodForAcceptanceDate(dateForPeriod, meta);
        if (resolved) {
          payload = { ...payload, period: resolved };
        }
      }
    }

    if (
      errors.length === row.errors.length &&
      warnings.length === row.warnings.length &&
      payload === row.payload
    ) {
      return row;
    }
    return { ...row, errors, warnings, payload };
  });
}

export function summarizeImportRows(mapped: MappedAccountingRow[]) {
  const skipped = mapped.filter((r) => r.skipped);
  const invalid = mapped.filter((r) => !r.skipped && r.errors.length > 0);
  const importable = mapped.filter(
    (r) => r.payload && !r.skipped && r.errors.length === 0,
  );
  const noContract = invalid.filter((r) =>
    r.errors.some((e) => e.includes('Không tìm thấy Số HĐ')),
  );
  const missingContractNos = [
    ...new Set(
      noContract
        .map((r) => r.payload?.contractNo?.trim())
        .filter(Boolean) as string[],
    ),
  ].sort((a, b) => a.localeCompare(b, 'vi'));

  return {
    skipped,
    invalid,
    importable,
    noContract,
    missingContractNos,
  };
}
