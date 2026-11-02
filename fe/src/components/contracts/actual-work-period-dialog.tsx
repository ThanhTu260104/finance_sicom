'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { financialControlApi } from '@/lib/api';
import { formatPeriod } from '@/lib/format';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { MoneyInput } from '@/components/ui/money-input';

export function ActualWorkPeriodDialog({
  open,
  onOpenChange,
  contractId,
  period,
  monthlyFinancialId,
  initialAmount,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contractId: string;
  period: string;
  monthlyFinancialId?: string | null;
  initialAmount: string;
  onSaved: () => void;
}) {
  const [amount, setAmount] = useState(initialAmount);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setAmount(initialAmount);
  }, [open, initialAmount]);

  const handleSave = async () => {
    const raw = amount.trim() || '0';
    if (!/^\d+(\.\d{1,2})?$/.test(raw)) {
      toast.error('Số tiền thực hiện không hợp lệ');
      return;
    }
    setBusy(true);
    try {
      if (monthlyFinancialId) {
        await financialControlApi.updateMonthlyFinancial(monthlyFinancialId, {
          actualWorkAmount: Number(raw),
        });
      } else {
        await financialControlApi.createMonthlyFinancial(contractId, {
          period,
          actualWorkAmount: Number(raw),
        });
      }
      toast.success(`Đã lưu thực hiện tháng ${formatPeriod(period)}`);
      onOpenChange(false);
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Lưu thất bại');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Thực hiện tháng {formatPeriod(period)}</DialogTitle>
          <DialogDescription>
            Giá trị công việc hoàn thành trong tháng (VND), không phải kế hoạch
            nghiệm thu.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="space-y-2">
            <Label htmlFor="actual-work-amount">Số tiền thực hiện</Label>
            <MoneyInput
              id="actual-work-amount"
              value={amount}
              onChange={setAmount}
              autoFocus
            />
          </div>
        </DialogBody>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Hủy
          </Button>
          <Button type="button" onClick={() => void handleSave()} disabled={busy}>
            {busy ? 'Đang lưu…' : 'Lưu'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
