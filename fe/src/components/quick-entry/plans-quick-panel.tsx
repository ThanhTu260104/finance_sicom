'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { revenuePlansApi } from '@/lib/api';
import { isValidAmount, normalizeAmount } from '@/lib/csv';
import { formatCurrencyVND } from '@/lib/format';
import {
  REVENUE_PLAN_CSV_COLUMNS,
  REVENUE_PLAN_CSV_SAMPLE_ROWS,
  revenuePlanCsvRowToPayload,
  revenuePlanToCsvRow,
  validateRevenuePlanCsvRow,
} from '@/lib/revenue-plan-csv';
import type { RevenuePlan } from '@/lib/types';
import { PlanBatchDateRange } from '@/components/shared/plan-batch-date-range';
import { CsvDataTransfer } from '@/components/shared/csv-data-transfer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MoneyInput } from '@/components/ui/money-input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export function PlansQuickPanel({
  contractId,
  contractNo,
}: {
  contractId: string;
  contractNo: string;
}) {
  const [batchSequence, setBatchSequence] = useState('1');
  const [periodStartDate, setPeriodStartDate] = useState('');
  const [periodEndDate, setPeriodEndDate] = useState('');
  const [plannedAmount, setPlannedAmount] = useState('');
  const [plannedAcceptanceDate, setPlannedAcceptanceDate] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [recent, setRecent] = useState<RevenuePlan[]>([]);

  const loadRecent = useCallback(async () => {
    try {
      const summary = await revenuePlansApi.list(contractId);
      setRecent([...summary.data].reverse().slice(0, 12));
    } catch {
      setRecent([]);
    }
  }, [contractId]);

  useEffect(() => {
    loadRecent();
  }, [loadRecent]);

  const buildPayload = () =>
    revenuePlanCsvRowToPayload({
      batchSequence,
      periodStartDate,
      periodEndDate,
      period: '',
      plannedAmount,
      plannedAcceptanceDate,
      note,
    });

  const handleSave = async (andContinue: boolean) => {
    const errors = validateRevenuePlanCsvRow({
      batchSequence,
      periodStartDate,
      periodEndDate,
      period: '',
      plannedAmount,
      plannedAcceptanceDate,
      note,
    });
    if (errors.length > 0) {
      toast.error(errors.join(' · '));
      return;
    }
    setSaving(true);
    try {
      await revenuePlansApi.create(contractId, buildPayload());
      toast.success('Đã lưu kế hoạch nghiệm thu');
      await loadRecent();
      if (andContinue) {
        setPlannedAmount('');
        setNote('');
        setBatchSequence(String(Number(batchSequence) + 1));
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Lưu thất bại');
    } finally {
      setSaving(false);
    }
  };

  const handleImport = async (rows: Array<Record<string, string>>) => {
    let ok = 0;
    for (const row of rows) {
      try {
        await revenuePlansApi.create(contractId, revenuePlanCsvRowToPayload(row));
        ok += 1;
      } catch {
        /* skip duplicate / invalid row */
      }
    }
    toast.success(`Đã thêm ${ok}/${rows.length} kế hoạch`);
    await loadRecent();
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 rounded-lg border border-slate-200 bg-slate-50/60 p-4 md:grid-cols-3">
        <div className="space-y-1">
          <Label className="text-xs">Số đợt NT</Label>
          <Input
            inputMode="numeric"
            value={batchSequence}
            onChange={(e) => setBatchSequence(e.target.value)}
            placeholder="1"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Từ ngày</Label>
          <Input
            type="date"
            value={periodStartDate}
            onChange={(e) => setPeriodStartDate(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Đến ngày</Label>
          <Input
            type="date"
            value={periodEndDate}
            onChange={(e) => setPeriodEndDate(e.target.value)}
          />
        </div>
        <div className="space-y-1 md:col-span-2">
          <Label className="text-xs">Kế hoạch nghiệm thu (VND)</Label>
          <MoneyInput value={plannedAmount} onChange={setPlannedAmount} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Ngày NT dự kiến</Label>
          <Input
            type="date"
            value={plannedAcceptanceDate}
            onChange={(e) => setPlannedAcceptanceDate(e.target.value)}
          />
        </div>
        <div className="space-y-1 md:col-span-3">
          <Label className="text-xs">Ghi chú</Label>
          <Input value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <div className="flex flex-wrap items-end gap-2 md:col-span-3">
          <Button size="sm" disabled={saving} onClick={() => handleSave(true)}>
            Lưu &amp; thêm tiếp
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={saving}
            onClick={() => handleSave(false)}
          >
            Lưu
          </Button>
          <CsvDataTransfer
            title="kế hoạch NT theo đợt"
            filenamePrefix={`ke-hoach-nt-${contractNo.replace(/[^\w-]+/g, '_')}`}
            columns={[...REVENUE_PLAN_CSV_COLUMNS]}
            sampleRows={REVENUE_PLAN_CSV_SAMPLE_ROWS}
            exportRows={recent.map((r) => revenuePlanToCsvRow(r))}
            validateRow={validateRevenuePlanCsvRow}
            onImport={handleImport}
          />
        </div>
      </div>

      {recent.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Đợt / khoảng ngày</TableHead>
              <TableHead className="text-right">Kế hoạch</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {recent.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <PlanBatchDateRange
                    batchSequence={r.batchSequence}
                    periodStartDate={r.periodStartDate}
                    periodEndDate={r.periodEndDate}
                  />
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCurrencyVND(r.plannedAmount)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
