'use client';

import { useState } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { acceptancesApi, contractsApi } from '@/lib/api';
import type { Contract } from '@/lib/types';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

const CONCURRENCY = 8;

async function fetchAllContracts() {
  const limit = 100;
  const all: Contract[] = [];
  let page = 1;
  let totalPages = 1;
  while (page <= totalPages) {
    const res = await contractsApi.list({
      page,
      limit,
      sortBy: 'contractNo',
      sortOrder: 'asc',
    });
    all.push(...res.data);
    totalPages = res.meta.totalPages;
    page += 1;
  }
  return all;
}

async function mapInBatches<T>(
  items: T[],
  batchSize: number,
  fn: (item: T) => Promise<void>,
) {
  for (let i = 0; i < items.length; i += batchSize) {
    const chunk = items.slice(i, i + batchSize);
    await Promise.all(chunk.map(fn));
  }
}

export function AcceptancesClearAll({
  onCleared,
}: {
  onCleared?: () => void;
}) {
  const [clearing, setClearing] = useState(false);
  const [open, setOpen] = useState(false);

  const handleClear = async () => {
    setClearing(true);
    try {
      const contracts = await fetchAllContracts();
      const ids: string[] = [];
      for (const contract of contracts) {
        const list = await acceptancesApi.list(contract.id);
        for (const row of list) ids.push(row.id);
      }
      if (ids.length === 0) {
        toast.message('Không có nghiệm thu để xóa');
        setOpen(false);
        return;
      }
      await mapInBatches(ids, CONCURRENCY, async (id) => {
        await acceptancesApi.remove(id);
      });
      toast.success(`Đã xóa ${ids.length} nghiệm thu trên toàn bộ hợp đồng`);
      setOpen(false);
      onCleared?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Xóa thất bại');
    } finally {
      setClearing(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={(v) => !clearing && setOpen(v)}>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant="destructive"
          disabled={clearing}
        >
          {clearing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
          Xóa hết nghiệm thu
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Xóa toàn bộ nghiệm thu?</AlertDialogTitle>
          <AlertDialogDescription>
            Xóa mềm mọi dòng nghiệm thu trên tất cả hợp đồng (kèm thu tiền tự
            sync nếu có). Dùng khi reset dữ liệu demo — thao tác khó hoàn tác.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={clearing}>Hủy</AlertDialogCancel>
          <AlertDialogAction
            disabled={clearing}
            onClick={(e) => {
              e.preventDefault();
              void handleClear();
            }}
          >
            {clearing ? 'Đang xóa…' : 'Xóa hết'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
