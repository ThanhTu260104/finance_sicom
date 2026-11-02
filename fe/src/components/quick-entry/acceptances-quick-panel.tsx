'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { acceptancesApi } from '@/lib/api';
import {
  isValidAmount,
  isValidPeriod,
  normalizeAmount,
} from '@/lib/csv';
import { formatCurrencyVND, formatPeriod, toDateInputValue } from '@/lib/format';
import { currentCalendarPeriod } from '@/lib/period';
import type {
  Acceptance,
  AcceptancePaymentStatus,
  DocumentStatus,
} from '@/lib/types';
import { ConfirmDeleteButton } from '@/components/shared/confirm-delete-button';
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

type QuickPreset = 'COLLECTED' | 'WAITING' | 'NOT_SUBMITTED';

function presetFromAcceptance(row: Acceptance): QuickPreset {
  if (row.documentStatus === 'NOT_SUBMITTED') return 'NOT_SUBMITTED';
  if (row.paymentStatus === 'COLLECTED') return 'COLLECTED';
  return 'WAITING';
}

export function AcceptancesQuickPanel({
  contractId,
  contractNo,
  refreshSignal,
}: {
  contractId: string;
  contractNo?: string;
  refreshSignal?: number;
}) {
  const [period, setPeriod] = useState(currentCalendarPeriod);
  const [acceptanceNo, setAcceptanceNo] = useState('');
  const [amount, setAmount] = useState('');
  const [invoiceNo, setInvoiceNo] = useState('');
  const [acceptanceDate, setAcceptanceDate] = useState('');
  const [invoiceDate, setInvoiceDate] = useState('');
  const [preset, setPreset] = useState<QuickPreset>('WAITING');
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<Acceptance[]>([]);
  const [editing, setEditing] = useState<Acceptance | null>(null);

  const loadRows = useCallback(async () => {
    try {
      const list = await acceptancesApi.list(contractId);
      setRows(list);
    } catch {
      setRows([]);
    }
  }, [contractId]);

  useEffect(() => {
    loadRows();
  }, [loadRows, refreshSignal]);

  const resetForm = () => {
    setEditing(null);
    setAcceptanceNo('');
    setAmount('');
    setInvoiceNo('');
    setAcceptanceDate('');
    setInvoiceDate('');
    setPeriod(currentCalendarPeriod);
    setPreset('WAITING');
  };

  const startEdit = (row: Acceptance) => {
    setEditing(row);
    setAcceptanceNo(row.acceptanceNo);
    setPeriod(row.period);
    setAmount(String(row.amount));
    setInvoiceNo(row.invoiceNo ?? '');
    setAcceptanceDate(toDateInputValue(row.acceptanceDate));
    setInvoiceDate(toDateInputValue(row.invoiceDate));
    setPreset(presetFromAcceptance(row));
  };

  const buildPayload = () => {
    const documentStatus: DocumentStatus =
      preset === 'NOT_SUBMITTED' ? 'NOT_SUBMITTED' : 'SUBMITTED_UNPAID';
    const paymentStatus: AcceptancePaymentStatus =
      preset === 'NOT_SUBMITTED'
        ? 'NOT_ACCEPTED'
        : preset === 'COLLECTED'
          ? 'COLLECTED'
          : 'WAITING_CLIENT_PAYMENT';
    return {
      acceptanceNo: acceptanceNo.trim(),
      period,
      amount: Number(normalizeAmount(amount)),
      documentStatus,
      paymentStatus,
      invoiceNo: invoiceNo.trim() || undefined,
      acceptanceDate: acceptanceDate
        ? new Date(`${acceptanceDate}T00:00:00.000Z`).toISOString()
        : undefined,
      invoiceDate: invoiceDate
        ? new Date(`${invoiceDate}T00:00:00.000Z`).toISOString()
        : undefined,
    };
  };

  const handleSave = async (andContinue: boolean) => {
    if (!acceptanceNo.trim()) {
      toast.error('Nhập số đợt / mã nghiệm thu');
      return;
    }
    if (!isValidPeriod(period) || !isValidAmount(amount)) {
      toast.error('Kiểm tra kỳ và số tiền');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await acceptancesApi.update(editing.id, buildPayload());
        toast.success('Đã cập nhật nghiệm thu');
      } else {
        await acceptancesApi.create(contractId, buildPayload());
        toast.success('Đã thêm nghiệm thu');
      }
      await loadRows();
      if (andContinue && !editing) {
        setAcceptanceNo('');
        setAmount('');
        setInvoiceNo('');
        setAcceptanceDate('');
        setInvoiceDate('');
      } else {
        resetForm();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Lưu thất bại');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await acceptancesApi.remove(id);
      toast.success('Đã xóa nghiệm thu');
      if (editing?.id === id) resetForm();
      await loadRows();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Xóa thất bại');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-600">
          {editing ? (
            <>
              Đang sửa: <strong>{editing.acceptanceNo}</strong>
            </>
          ) : (
            'Thêm hoặc sửa nghiệm thu trên HĐ đã chọn'
          )}
        </p>
        <Button asChild size="sm" variant="ghost">
          <Link href={`/contracts/${contractId}?tab=acceptances`}>
            Form đầy đủ / đính kèm
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 rounded-lg border border-slate-200 bg-slate-50/60 p-4 md:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1">
          <Label className="text-xs">Kỳ (tháng)</Label>
          <Input
            type="month"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          />
        </div>
        <div className="space-y-1 md:col-span-2">
          <Label className="text-xs">Mã NT / Ký hiệu HĐ *</Label>
          <Input
            value={acceptanceNo}
            onChange={(e) => setAcceptanceNo(e.target.value)}
            placeholder="C26TSC1 hoặc Đợt 01/2026"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Số tiền *</Label>
          <MoneyInput value={amount} onChange={setAmount} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Số hóa đơn</Label>
          <Input value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Ngày NT</Label>
          <Input
            type="date"
            value={acceptanceDate}
            onChange={(e) => setAcceptanceDate(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Ngày hóa đơn</Label>
          <Input
            type="date"
            value={invoiceDate}
            onChange={(e) => setInvoiceDate(e.target.value)}
          />
        </div>
        <div className="space-y-1 md:col-span-2 lg:col-span-3">
          <Label className="text-xs">Trạng thái nhanh</Label>
          <Select
            value={preset}
            onChange={(e) => setPreset(e.target.value as QuickPreset)}
          >
            <option value="WAITING">Đã NT — chờ thu</option>
            <option value="COLLECTED">Đã NT — đã thu (sync thu tiền)</option>
            <option value="NOT_SUBMITTED">Chưa nộp hồ sơ</option>
          </Select>
        </div>
        <div className="flex flex-wrap items-end gap-2 md:col-span-3">
          {editing ? (
            <>
              <Button size="sm" disabled={saving} onClick={() => handleSave(false)}>
                Lưu sửa
              </Button>
              <Button size="sm" variant="outline" onClick={resetForm}>
                Hủy sửa
              </Button>
            </>
          ) : (
            <>
              <Button
                size="sm"
                disabled={saving}
                onClick={() => handleSave(true)}
              >
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
            </>
          )}
        </div>
      </div>

      {rows.length > 0 ? (
        <div className="overflow-x-auto rounded-md border border-slate-200">
          <p className="border-b bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700">
            Nghiệm thu trên HĐ {contractNo ? `«${contractNo}»` : ''} ({rows.length})
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kỳ</TableHead>
                <TableHead>Mã NT</TableHead>
                <TableHead className="text-right">Số tiền</TableHead>
                <TableHead className="text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow
                  key={r.id}
                  className={editing?.id === r.id ? 'bg-slate-100' : undefined}
                >
                  <TableCell>{formatPeriod(r.period)}</TableCell>
                  <TableCell className="max-w-[160px] truncate font-mono text-xs">
                    {r.acceptanceNo}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrencyVND(r.amount)}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => startEdit(r)}
                      >
                        Sửa
                      </Button>
                      <ConfirmDeleteButton
                        onConfirm={() => handleDelete(r.id)}
                        title="Xóa nghiệm thu?"
                        description={`Xóa ${r.acceptanceNo} trên HĐ này.`}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <p className="text-sm text-slate-500">Chưa có nghiệm thu trên HĐ này.</p>
      )}
    </div>
  );
}
