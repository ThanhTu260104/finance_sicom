'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { contractsApi, revenuePlansApi } from '@/lib/api';
import { formatCurrencyVND, formatPeriod, toDateInputValue } from '@/lib/format';
import {
  REVENUE_PLAN_BULK_CSV_COLUMNS,
  REVENUE_PLAN_CSV_SAMPLE_ROWS,
  revenuePlanCsvRowToPayload,
  revenuePlanToCsvRow,
  validateRevenuePlanCsvRow,
} from '@/lib/revenue-plan-csv';
import { fetchAllPaginated } from '@/lib/fetch-all-paginated';
import {
  PERIOD_MONTH_MAX,
  PERIOD_MONTH_MIN,
} from '@/lib/period-input-bounds';
import type { Contract, RevenuePlan } from '@/lib/types';
import { ConfirmDeleteButton } from '@/components/shared/confirm-delete-button';
import { CsvDataTransfer } from '@/components/shared/csv-data-transfer';
import { PlanBatchDateRange } from '@/components/shared/plan-batch-date-range';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MoneyInput } from '@/components/ui/money-input';
import { Select } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const LOAD_CONCURRENCY = 8;

type PlanGridRow = {
  id: string;
  contractId: string;
  contractNo: string;
  contractName: string;
  projectId: string;
  projectCode: string;
  projectName: string;
  period: string;
  batchSequence: number | null;
  periodStartDate: string | null;
  periodEndDate: string | null;
  plannedAmount: string;
  plannedAcceptanceDate: string | null;
  note: string | null;
};

function planToGridRow(c: Contract, p: RevenuePlan): PlanGridRow {
  return {
    id: p.id,
    contractId: c.id,
    contractNo: c.contractNo,
    contractName: c.name,
    projectId: c.projectId,
    projectCode: c.project?.code ?? '—',
    projectName: c.project?.name ?? '—',
    period: p.period,
    batchSequence: p.batchSequence ?? null,
    periodStartDate: p.periodStartDate ?? null,
    periodEndDate: p.periodEndDate ?? null,
    plannedAmount: String(p.plannedAmount),
    plannedAcceptanceDate: p.plannedAcceptanceDate ?? null,
    note: p.note ?? null,
  };
}

function sortPlanRows(a: PlanGridRow, b: PlanGridRow) {
  const pc = a.projectCode.localeCompare(b.projectCode, 'vi');
  if (pc !== 0) return pc;
  const cc = a.contractNo.localeCompare(b.contractNo, 'vi');
  if (cc !== 0) return cc;
  if (a.batchSequence != null && b.batchSequence != null) {
    return a.batchSequence - b.batchSequence;
  }
  return a.period.localeCompare(b.period);
}

export function PlansBulkQuickPanel({
  highlightContractId,
}: {
  highlightContractId?: string;
}) {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [rows, setRows] = useState<PlanGridRow[]>([]);
  const [loadingContracts, setLoadingContracts] = useState(true);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [loadProgress, setLoadProgress] = useState('');

  const [projectFilter, setProjectFilter] = useState('');
  const [periodFilter, setPeriodFilter] = useState('');

  const [addContractId, setAddContractId] = useState('');
  const [addBatch, setAddBatch] = useState('1');
  const [addFrom, setAddFrom] = useState('');
  const [addTo, setAddTo] = useState('');
  const [addAmount, setAddAmount] = useState('');
  const [addNote, setAddNote] = useState('');
  const [adding, setAdding] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBatch, setEditBatch] = useState('');
  const [editFrom, setEditFrom] = useState('');
  const [editTo, setEditTo] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editNote, setEditNote] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const loadContracts = useCallback(async () => {
    setLoadingContracts(true);
    try {
      const all = await fetchAllPaginated((page, limit) =>
        contractsApi.list({
          page,
          limit,
          sortBy: 'contractNo',
          sortOrder: 'asc',
        }),
      );
      setContracts(all);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Không tải được danh sách HĐ',
      );
      setContracts([]);
    } finally {
      setLoadingContracts(false);
    }
  }, []);

  const loadPlans = useCallback(async (list: Contract[]) => {
    if (list.length === 0) {
      setRows([]);
      return;
    }
    setLoadingPlans(true);
    setLoadProgress(`0 / ${list.length} HĐ`);
    try {
      const chunks: PlanGridRow[][] = [];
      let done = 0;
      for (let i = 0; i < list.length; i += LOAD_CONCURRENCY) {
        const chunk = list.slice(i, i + LOAD_CONCURRENCY);
        const part = await Promise.all(
          chunk.map(async (c) => {
            try {
              const summary = await revenuePlansApi.list(c.id);
              return summary.data.map((p) => planToGridRow(c, p));
            } catch {
              return [] as PlanGridRow[];
            } finally {
              done += 1;
              setLoadProgress(`${done} / ${list.length} HĐ`);
            }
          }),
        );
        chunks.push(part.flat());
      }
      const merged = chunks.flat().sort(sortPlanRows);
      setRows(merged);
    } finally {
      setLoadingPlans(false);
      setLoadProgress('');
    }
  }, []);

  useEffect(() => {
    void loadContracts();
  }, [loadContracts]);

  useEffect(() => {
    if (loadingContracts) return;
    void loadPlans(contracts);
  }, [contracts, loadingContracts, loadPlans]);

  useEffect(() => {
    if (highlightContractId) {
      setAddContractId(highlightContractId);
      const c = contracts.find((x) => x.id === highlightContractId);
      if (c?.projectId) setProjectFilter(c.projectId);
    }
  }, [highlightContractId, contracts]);

  const projects = useMemo(() => {
    const map = new Map<
      string,
      { id: string; code: string; name: string }
    >();
    for (const c of contracts) {
      if (c.project) {
        map.set(c.project.id, {
          id: c.project.id,
          code: c.project.code,
          name: c.project.name,
        });
      }
    }
    return [...map.values()].sort((a, b) =>
      a.code.localeCompare(b.code, 'vi'),
    );
  }, [contracts]);

  const contractsForAdd = useMemo(() => {
    let list = contracts;
    if (projectFilter) {
      list = list.filter((c) => c.projectId === projectFilter);
    }
    return list;
  }, [contracts, projectFilter]);

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (projectFilter && r.projectId !== projectFilter) return false;
      if (periodFilter && r.period !== periodFilter) return false;
      return true;
    });
  }, [rows, projectFilter, periodFilter]);

  const reloadAll = async () => {
    await loadContracts();
  };

  const handleAdd = async () => {
    if (!addContractId) {
      toast.error('Chọn hợp đồng');
      return;
    }
    const row = {
      batchSequence: addBatch,
      periodStartDate: addFrom,
      periodEndDate: addTo,
      period: '',
      plannedAmount: addAmount,
      note: addNote,
    };
    const errors = validateRevenuePlanCsvRow(row);
    if (errors.length > 0) {
      toast.error(errors.join(' · '));
      return;
    }
    setAdding(true);
    try {
      await revenuePlansApi.create(
        addContractId,
        revenuePlanCsvRowToPayload(row),
      );
      toast.success('Đã thêm kế hoạch NT');
      setAddAmount('');
      setAddNote('');
      await loadPlans(contracts);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Thêm thất bại');
    } finally {
      setAdding(false);
    }
  };

  const startEdit = (row: PlanGridRow) => {
    setEditingId(row.id);
    setEditBatch(row.batchSequence != null ? String(row.batchSequence) : '');
    setEditFrom(toDateInputValue(row.periodStartDate));
    setEditTo(toDateInputValue(row.periodEndDate));
    setEditAmount(row.plannedAmount);
    setEditNote(row.note ?? '');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditBatch('');
    setEditFrom('');
    setEditTo('');
    setEditAmount('');
    setEditNote('');
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const row = {
      batchSequence: editBatch,
      periodStartDate: editFrom,
      periodEndDate: editTo,
      period: '',
      plannedAmount: editAmount,
      note: editNote,
    };
    const errors = validateRevenuePlanCsvRow(row);
    if (errors.length > 0) {
      toast.error(errors.join(' · '));
      return;
    }
    setSavingEdit(true);
    try {
      await revenuePlansApi.update(editingId, revenuePlanCsvRowToPayload(row));
      toast.success('Đã cập nhật kế hoạch');
      cancelEdit();
      await loadPlans(contracts);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Lưu thất bại');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await revenuePlansApi.remove(id);
      toast.success('Đã xóa kế hoạch');
      if (editingId === id) cancelEdit();
      await loadPlans(contracts);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Xóa thất bại');
    }
  };

  const handleBulkImport = async (importRows: Array<Record<string, string>>) => {
    let ok = 0;
    for (const row of importRows) {
      const no = row.contractNo?.trim();
      if (!no) continue;
      const contract = contracts.find(
        (c) => c.contractNo.trim().toLowerCase() === no.toLowerCase(),
      );
      if (!contract) continue;
      try {
        await revenuePlansApi.create(
          contract.id,
          revenuePlanCsvRowToPayload(row),
        );
        ok += 1;
      } catch {
        /* duplicate / invalid */
      }
    }
    toast.success(`Import: ${ok}/${importRows.length} dòng`);
    await loadPlans(contracts);
  };

  const busy = loadingContracts || loadingPlans;

  const bulkSampleRows = REVENUE_PLAN_CSV_SAMPLE_ROWS.map((r, i) => ({
    contractNo: contracts[0]?.contractNo ?? 'HĐ-mẫu',
    ...r,
    batchSequence: String(Number(r.batchSequence) + i),
  }));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-800">
            Bảng kế hoạch nghiệm thu theo dự án / hợp đồng
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            Đợt · Từ ngày · Đến ngày · Kế hoạch — Excel có cột Số HĐ cho import
            nhiều HĐ
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CsvDataTransfer
            title="kế hoạch NT (nhiều HĐ)"
            filenamePrefix="ke-hoach-nt-tat-ca"
            columns={[...REVENUE_PLAN_BULK_CSV_COLUMNS]}
            sampleRows={bulkSampleRows}
            exportRows={rows.map((r) => ({
              contractNo: r.contractNo,
              ...revenuePlanToCsvRow(r),
            }))}
            validateRow={(row) => {
              const errors = validateRevenuePlanCsvRow(row);
              if (!row.contractNo?.trim()) errors.push('Thiếu Số HĐ');
              return errors;
            }}
            onImport={handleBulkImport}
          />
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => void reloadAll()}
        >
          <RefreshCw className={`h-4 w-4 ${loadingPlans ? 'animate-spin' : ''}`} />
          Tải lại
        </Button>
        </div>
      </div>

      <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50/60 p-4 md:grid-cols-4">
        <div className="space-y-1">
          <Label className="text-xs">Lọc dự án</Label>
          <Select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
          >
            <option value="">Tất cả dự án</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} — {p.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Lọc tháng (kỳ)</Label>
          <Input
            type="month"
            min={PERIOD_MONTH_MIN}
            max={PERIOD_MONTH_MAX}
            value={periodFilter}
            onChange={(e) => setPeriodFilter(e.target.value)}
          />
        </div>
        <div className="flex items-end md:col-span-2">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="text-xs"
            onClick={() => {
              setProjectFilter('');
              setPeriodFilter('');
            }}
          >
            Xóa lọc — hiện mọi kỳ
          </Button>
        </div>
      </div>

      <div className="grid gap-3 rounded-lg border border-dashed border-slate-300 bg-white p-4 md:grid-cols-2 lg:grid-cols-6">
        <div className="space-y-1 lg:col-span-2">
          <Label className="text-xs">Thêm — Hợp đồng</Label>
          <Select
            value={addContractId}
            onChange={(e) => setAddContractId(e.target.value)}
          >
            <option value="">Chọn HĐ…</option>
            {contractsForAdd.map((c) => (
              <option key={c.id} value={c.id}>
                {c.project?.code ?? '?'} · {c.contractNo} — {c.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Đợt</Label>
          <Input
            inputMode="numeric"
            value={addBatch}
            onChange={(e) => setAddBatch(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Từ ngày</Label>
          <Input type="date" value={addFrom} onChange={(e) => setAddFrom(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Đến ngày</Label>
          <Input type="date" value={addTo} onChange={(e) => setAddTo(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Kế hoạch NT</Label>
          <MoneyInput value={addAmount} onChange={setAddAmount} />
        </div>
        <div className="flex items-end">
          <Button
            type="button"
            size="sm"
            className="w-full"
            disabled={adding || busy}
            onClick={() => void handleAdd()}
          >
            {adding ? 'Đang lưu…' : 'Thêm kế hoạch'}
          </Button>
        </div>
        <div className="space-y-1 md:col-span-2 lg:col-span-6">
          <Label className="text-xs">Ghi chú (tùy chọn)</Label>
          <Input
            value={addNote}
            onChange={(e) => setAddNote(e.target.value)}
            placeholder="Ghi chú ngắn"
          />
        </div>
      </div>

      {busy ? (
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-600">
          <Loader2 className="h-5 w-5 animate-spin" />
          {loadingContracts
            ? 'Đang tải hợp đồng…'
            : `Đang gom kế hoạch NT… ${loadProgress}`}
        </div>
      ) : filteredRows.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500">
          {rows.length === 0
            ? 'Chưa có kế hoạch nghiệm thu trên bất kỳ HĐ nào.'
            : 'Không có dòng nào khớp bộ lọc — đổi dự án hoặc tháng, hoặc thêm kế hoạch mới.'}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-slate-200">
          <p className="border-b bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700">
            {filteredRows.length} dòng
            {periodFilter ? ` · kỳ ${formatPeriod(periodFilter)}` : ''}
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[100px]">Mã dự án</TableHead>
                <TableHead className="min-w-[140px]">Dự án</TableHead>
                <TableHead className="min-w-[120px]">Hợp đồng</TableHead>
                <TableHead>Đợt / khoảng ngày</TableHead>
                <TableHead className="text-right">Kế hoạch NT</TableHead>
                <TableHead className="min-w-[120px]">Ghi chú</TableHead>
                <TableHead className="text-right w-[140px]">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRows.map((r) => {
                const isEdit = editingId === r.id;
                const highlighted =
                  highlightContractId && r.contractId === highlightContractId;
                return (
                  <TableRow
                    key={r.id}
                    className={
                      isEdit
                        ? 'bg-slate-100'
                        : highlighted
                          ? 'bg-teal-50/50'
                          : undefined
                    }
                  >
                    <TableCell className="font-mono text-xs">
                      <Link
                        href={`/projects/${r.projectId}`}
                        className="underline-offset-2 hover:underline"
                      >
                        {r.projectCode}
                      </Link>
                    </TableCell>
                    <TableCell className="max-w-[180px] truncate text-sm">
                      {r.projectName}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/contracts/${r.contractId}`}
                        className="text-sm font-medium underline-offset-2 hover:underline"
                      >
                        {r.contractNo}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {isEdit ? (
                        <div className="flex min-w-[220px] flex-col gap-1">
                          <Input
                            className="h-8"
                            inputMode="numeric"
                            placeholder="Đợt"
                            value={editBatch}
                            onChange={(e) => setEditBatch(e.target.value)}
                          />
                          <div className="flex gap-1">
                            <Input
                              type="date"
                              className="h-8"
                              value={editFrom}
                              onChange={(e) => setEditFrom(e.target.value)}
                            />
                            <Input
                              type="date"
                              className="h-8"
                              value={editTo}
                              onChange={(e) => setEditTo(e.target.value)}
                            />
                          </div>
                        </div>
                      ) : (
                        <PlanBatchDateRange
                          batchSequence={r.batchSequence}
                          periodStartDate={r.periodStartDate}
                          periodEndDate={r.periodEndDate}
                        />
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {isEdit ? (
                        <MoneyInput
                          className="ml-auto max-w-[11rem]"
                          value={editAmount}
                          onChange={setEditAmount}
                        />
                      ) : (
                        <span className="tabular-nums">
                          {formatCurrencyVND(r.plannedAmount)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {isEdit ? (
                        <Input
                          className="h-8"
                          value={editNote}
                          onChange={(e) => setEditNote(e.target.value)}
                        />
                      ) : (
                        <span className="line-clamp-2 text-xs text-slate-600">
                          {r.note ?? '—'}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        {isEdit ? (
                          <>
                            <Button
                              type="button"
                              size="sm"
                              disabled={savingEdit}
                              onClick={() => void saveEdit()}
                            >
                              Lưu
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={cancelEdit}
                            >
                              Hủy
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              onClick={() => startEdit(r)}
                            >
                              Sửa
                            </Button>
                            <ConfirmDeleteButton
                              onConfirm={() => void handleDelete(r.id)}
                              title="Xóa kế hoạch NT?"
                              description={`Kỳ ${formatPeriod(r.period)} · HĐ ${r.contractNo}`}
                            />
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
