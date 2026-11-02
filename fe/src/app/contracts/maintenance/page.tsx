'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Save, Search } from 'lucide-react';
import { toast } from 'sonner';
import {
  contractsApi,
  type MaintenanceDailyGridContract,
  type MaintenanceDailyGridResponse,
} from '@/lib/api';
import { isValidAmount, isValidOptionalDate, isValidPeriod } from '@/lib/csv';
import { formatCurrencyVND } from '@/lib/format';
import {
  formatGroupedNumber,
  parseGroupedNumber,
} from '@/lib/number-format';
import {
  buildMaintenanceDailyExportRows,
  MAINTENANCE_DAILY_CSV_COLUMNS,
} from '@/lib/maintenance-daily-csv';
import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { QueryState } from '@/components/shared/query-state';
import { CollapsibleFilters } from '@/components/shared/collapsible-filters';
import { CsvDataTransfer } from '@/components/shared/csv-data-transfer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { MoneyInput } from '@/components/ui/money-input';
import { cn } from '@/lib/utils';
import { WriteOnly } from '@/components/auth/auth-provider';

function currentPeriodYm(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function cellKey(contractId: string, workDate: string) {
  return `${contractId}|${workDate}`;
}

function normalizeAmount(raw: string | undefined): string {
  const parsed = parseGroupedNumber(raw ?? '');
  if (!parsed) return '0';
  return parsed;
}

function amountToNumber(raw: string | undefined): number | null {
  const parsed = parseGroupedNumber(raw ?? '');
  if (!parsed) return 0;
  if (!/^\d+(\.\d+)?$/.test(parsed)) return null;
  return Number(parsed);
}

function dayOfMonth(workDate: string): number {
  return Number(workDate.slice(8, 10));
}

function isWeekend(workDate: string): boolean {
  const [y, m, d] = workDate.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return dow === 0 || dow === 6;
}

function workDateInPeriod(workDate: string, period: string): boolean {
  return workDate.startsWith(`${period}-`);
}

function matchContractSearch(
  c: MaintenanceDailyGridContract,
  q: string,
): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return (
    c.contractNo.toLowerCase().includes(needle) ||
    c.name.toLowerCase().includes(needle) ||
    c.project.code.toLowerCase().includes(needle) ||
    c.project.name.toLowerCase().includes(needle)
  );
}

export default function ContractMaintenanceDailyPage() {
  const [period, setPeriod] = useState(currentPeriodYm);
  const [grid, setGrid] = useState<MaintenanceDailyGridResponse | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [projectCode, setProjectCode] = useState('');

  const load = useCallback(async (p: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await contractsApi.maintenanceDailyGrid(p);
      setGrid(res);
      const normalized: Record<string, string> = {};
      for (const [k, v] of Object.entries(res.amounts)) {
        normalized[k] = normalizeAmount(v);
      }
      setDraft(normalized);
    } catch (e) {
      setGrid(null);
      setDraft({});
      setError(e instanceof Error ? e.message : 'Không tải được lưới bảo trì');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(period);
  }, [period, load]);

  const projectOptions = useMemo(() => {
    if (!grid) return [];
    const map = new Map<string, string>();
    for (const c of grid.contracts) {
      map.set(c.project.code, c.project.name);
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b, 'vi'))
      .map(([code, name]) => ({ code, name }));
  }, [grid]);

  const filteredContracts = useMemo(() => {
    if (!grid) return [];
    return grid.contracts.filter((c) => {
      if (projectCode && c.project.code !== projectCode) return false;
      return matchContractSearch(c, search);
    });
  }, [grid, projectCode, search]);

  const contractByNoProject = useMemo(() => {
    const map = new Map<string, MaintenanceDailyGridContract>();
    if (!grid) return map;
    for (const c of grid.contracts) {
      map.set(`${c.project.code.toUpperCase()}|${c.contractNo.trim().toUpperCase()}`, c);
      map.set(c.contractNo.trim().toUpperCase(), c);
    }
    return map;
  }, [grid]);

  const dirtyKeys = useMemo(() => {
    if (!grid) return [];
    const keys: string[] = [];
    for (const [k, v] of Object.entries(draft)) {
      const base = normalizeAmount(grid.amounts[k]);
      if (normalizeAmount(v) !== base) keys.push(k);
    }
    return keys;
  }, [draft, grid]);

  const rowTotals = useMemo(() => {
    if (!grid) return {};
    const out: Record<string, number> = {};
    for (const c of grid.contracts) {
      let sum = 0;
      for (const d of grid.workDates) {
        const k = cellKey(c.id, d);
        const n = amountToNumber(draft[k] ?? '0');
        if (n != null) sum += n;
      }
      out[c.id] = sum;
    }
    return out;
  }, [draft, grid]);

  const handleSave = async () => {
    if (!grid || dirtyKeys.length === 0) return;
    const items: Array<{
      contractId: string;
      workDate: string;
      amount: number;
    }> = [];
    for (const k of dirtyKeys) {
      const [contractId, workDate] = k.split('|');
      const amount = amountToNumber(draft[k] ?? '');
      if (amount == null) {
        toast.error(`Giá trị không hợp lệ tại ${workDate}`);
        return;
      }
      items.push({ contractId, workDate, amount });
    }
    setSaving(true);
    try {
      await contractsApi.maintenanceDailyBulk({ period: grid.period, items });
      toast.success(`Đã lưu ${items.length} ô`);
      await load(grid.period);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Lưu thất bại');
    } finally {
      setSaving(false);
    }
  };

  const exportRows = useMemo(() => {
    if (!grid) return [];
    return buildMaintenanceDailyExportRows({
      period: grid.period,
      workDates: grid.workDates,
      contracts: filteredContracts,
      amounts: draft,
      onlyNonZero: true,
    });
  }, [draft, filteredContracts, grid]);

  const handleImportCsv = async (rows: Array<Record<string, string>>) => {
    if (!grid) return;
    const items: Array<{
      contractId: string;
      workDate: string;
      amount: number;
    }> = [];

    for (const row of rows) {
      const pCode = row.projectCode?.trim().toUpperCase() ?? '';
      const cNo = row.contractNo?.trim().toUpperCase() ?? '';
      const contract =
        contractByNoProject.get(`${pCode}|${cNo}`) ??
        (pCode ? undefined : contractByNoProject.get(cNo));
      if (!contract) {
        throw new Error(`Không tìm thấy HĐ: ${row.contractNo ?? '?'}`);
      }

      const workDate = row.workDate?.trim() ?? '';
      const amount = amountToNumber(row.amount);
      if (amount == null) {
        throw new Error(`Số tiền không hợp lệ (${workDate})`);
      }

      items.push({
        contractId: contract.id,
        workDate,
        amount,
      });
    }

    await contractsApi.maintenanceDailyBulk({ period: grid.period, items });
    toast.success(`Đã nhập ${items.length} dòng`);
    await load(grid.period);
  };

  const validateImportRow = (row: Record<string, string>) => {
    const errors: string[] = [];
    const rowPeriod = row.period?.trim() ?? '';
    if (!isValidPeriod(rowPeriod)) errors.push('Kỳ: YYYY-MM');
    else if (grid && rowPeriod !== grid.period) {
      errors.push(`Kỳ phải là ${grid.period} (tháng đang xem)`);
    }

    const pCode = row.projectCode?.trim();
    if (!pCode) errors.push('Thiếu mã dự án');

    const cNo = row.contractNo?.trim();
    if (!cNo) errors.push('Thiếu số HĐ');
    else if (grid) {
      const key = pCode
        ? `${pCode.toUpperCase()}|${cNo.toUpperCase()}`
        : cNo.toUpperCase();
      const contract =
        contractByNoProject.get(key) ?? contractByNoProject.get(cNo.toUpperCase());
      if (!contract) errors.push('Không tìm thấy HĐ bảo trì');
      else if (pCode && contract.project.code.toUpperCase() !== pCode.toUpperCase()) {
        errors.push('Mã dự án không khớp HĐ');
      }
    }

    const workDate = row.workDate?.trim() ?? '';
    if (!workDate) errors.push('Thiếu ngày');
    else if (!isValidOptionalDate(workDate)) errors.push('Ngày: YYYY-MM-DD');
    else if (grid && !workDateInPeriod(workDate, grid.period)) {
      errors.push('Ngày không thuộc tháng đang xem');
    }

    if (!isValidAmount(row.amount ?? '')) errors.push('Số tiền không hợp lệ');

    return errors;
  };

  return (
    <div className="space-y-4">
      <Breadcrumbs
        items={[
          { label: 'Hợp đồng', href: '/contracts' },
          { label: 'Bảo trì theo ngày' },
        ]}
      />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Thực hiện HĐ bảo trì theo ngày
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Mỗi ô là <span className="font-medium">số tiền (₫)</span> trong ngày
            (dấu chấm ngàn). Cuộn ngang để xem các ngày trong tháng.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <Label htmlFor="maint-period" className="text-xs text-slate-500">
              Tháng
            </Label>
            <Input
              id="maint-period"
              type="month"
              className="w-[10.5rem]"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
            />
          </div>
          {grid ? (
            <CsvDataTransfer
              title="bảo trì theo ngày"
              filenamePrefix={`bao-tri-ngay-${grid.period}`}
              columns={MAINTENANCE_DAILY_CSV_COLUMNS}
              sampleRows={[
                {
                  period: grid.period,
                  projectCode: grid.contracts[0]?.project.code ?? 'DA01',
                  contractNo: grid.contracts[0]?.contractNo ?? 'HD-001',
                  contractName: grid.contracts[0]?.name ?? '',
                  workDate: `${grid.period}-01`,
                  amount: '1500000',
                },
              ]}
              exportRows={exportRows}
              validateRow={validateImportRow}
              onImport={handleImportCsv}
            />
          ) : null}
          <WriteOnly>
            <Button
              type="button"
              disabled={saving || dirtyKeys.length === 0}
              onClick={() => void handleSave()}
            >
              <Save className="h-4 w-4" />
              Lưu {dirtyKeys.length > 0 ? `(${dirtyKeys.length})` : ''}
            </Button>
          </WriteOnly>
        </div>
      </div>

      <CollapsibleFilters defaultOpen>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              className="pl-9"
              placeholder="Tìm số HĐ, tên HĐ, mã/tên dự án…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select
            value={projectCode}
            onChange={(e) => setProjectCode(e.target.value)}
          >
            <option value="">Tất cả dự án</option>
            {projectOptions.map((p) => (
              <option key={p.code} value={p.code}>
                {p.code} — {p.name}
              </option>
            ))}
          </Select>
        </div>
        {grid ? (
          <p className="mt-2 text-xs text-slate-500">
            Hiển thị {filteredContracts.length}/{grid.contracts.length} hợp đồng
            bảo trì
          </p>
        ) : null}
      </CollapsibleFilters>

      <QueryState
        loading={loading}
        error={error}
        empty={
          !loading &&
          !error &&
          (grid?.contracts.length === 0 || filteredContracts.length === 0)
        }
        emptyMessage={
          grid?.contracts.length === 0
            ? 'Chưa có hợp đồng bảo trì. Gán loại Bảo trì trên hợp đồng trước.'
            : 'Không có HĐ nào khớp bộ lọc.'
        }
      >
        {grid && filteredContracts.length > 0 ? (
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="max-h-[min(70vh,calc(100dvh-14rem))] overflow-auto overscroll-contain">
              <table className="w-max min-w-full border-collapse text-xs">
                <thead className="sticky top-0 z-30">
                  <tr className="border-b border-slate-200 bg-slate-50 shadow-[0_1px_0_0_rgb(226_232_240)]">
                    <th className="sticky left-0 top-0 z-40 min-w-[14rem] max-w-[22rem] border-r border-slate-200 bg-slate-50 px-2 py-2 text-left text-xs font-semibold text-slate-700">
                      Dự án / HĐ
                    </th>
                    {grid.workDates.map((d) => (
                      <th
                        key={d}
                        className={cn(
                          'sticky top-0 z-30 bg-slate-50 w-[4.75rem] min-w-[4.75rem] px-0 py-2 text-center font-medium text-slate-600',
                          isWeekend(d) && 'bg-slate-100/90 text-slate-400',
                        )}
                        title={d}
                      >
                        {dayOfMonth(d)}
                      </th>
                    ))}
                    <th className="sticky right-0 top-0 z-40 min-w-[6rem] border-l border-slate-200 bg-slate-50 px-2 py-2 text-right font-semibold text-slate-700 shadow-[-4px_0_8px_-4px_rgba(15,23,42,0.08)]">
                      Tổng tháng
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredContracts.map((c) => (
                    <tr
                      key={c.id}
                      className="border-b border-slate-100 hover:bg-slate-50/50"
                    >
                      <td
                        className="sticky left-0 z-20 min-w-[14rem] max-w-[22rem] border-r border-slate-200 bg-white px-2 py-2 align-top shadow-[4px_0_8px_-4px_rgba(15,23,42,0.06)]"
                        title={c.project.code}
                      >
                        <p className="whitespace-normal break-words text-sm font-bold leading-snug text-slate-900">
                          {c.project.name}
                        </p>
                        <Link
                          href={`/contracts/${c.id}?tab=info`}
                          className="mt-1.5 inline-block text-[11px] font-medium text-slate-600 hover:text-slate-900 hover:underline"
                        >
                          {c.contractNo}
                        </Link>
                        <p className="mt-0.5 whitespace-normal break-words text-[11px] leading-snug text-slate-500">
                          {c.name}
                        </p>
                      </td>
                      {grid.workDates.map((d) => {
                        const k = cellKey(c.id, d);
                        return (
                          <td
                            key={d}
                            className={cn(
                              'p-0 align-middle',
                              isWeekend(d) && 'bg-slate-50/60',
                            )}
                          >
                            <MoneyInput
                              maxDecimals={0}
                              value={draft[k] ?? ''}
                              placeholder="·"
                              title={formatGroupedNumber(draft[k] ?? '', 0)}
                              className={cn(
                                'h-8 w-[4.75rem] min-w-[4.75rem] rounded-none border-0 bg-transparent px-0.5 text-center text-[10px] shadow-none',
                                'focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-slate-400',
                                dirtyKeys.includes(k) && 'bg-amber-50',
                              )}
                              onChange={(v) =>
                                setDraft((prev) => ({
                                  ...prev,
                                  [k]: v,
                                }))
                              }
                            />
                          </td>
                        );
                      })}
                      <td className="sticky right-0 z-20 border-l border-slate-200 bg-white px-2 py-2 text-right text-xs tabular-nums text-slate-800 shadow-[-4px_0_8px_-4px_rgba(15,23,42,0.06)]">
                        {formatCurrencyVND(String(rowTotals[c.id] ?? 0))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </QueryState>
    </div>
  );
}
