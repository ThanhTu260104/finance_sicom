'use client';

import { useEffect, useRef } from 'react';
import { Trash2 } from 'lucide-react';
import { TableCell, TableHead } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { useCanWrite } from '@/components/auth/auth-provider';
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

const checkboxClass =
  'h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-400';

export function TableHeadCheckbox({
  checked,
  indeterminate,
  onChange,
  disabled,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = Boolean(indeterminate);
  }, [indeterminate]);
  // Tài khoản chỉ xem: không chọn dòng (chọn chỉ để xóa hàng loạt)
  if (!useCanWrite()) return null;

  return (
    <TableHead className="w-10 px-3">
      <input
        ref={ref}
        type="checkbox"
        className={checkboxClass}
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        aria-label="Chọn tất cả"
      />
    </TableHead>
  );
}

export function TableCellCheckbox({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  if (!useCanWrite()) return null;
  return (
    <TableCell className="w-10 px-3">
      <input
        type="checkbox"
        className={checkboxClass}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        aria-label="Chọn dòng"
      />
    </TableCell>
  );
}

export function TableBulkActionBar({
  selectedCount,
  entityLabel,
  onClear,
  onConfirmDelete,
  deleting,
}: {
  selectedCount: number;
  entityLabel: string;
  onClear: () => void;
  onConfirmDelete: () => void | Promise<void>;
  deleting?: boolean;
}) {
  const writable = useCanWrite();
  if (selectedCount <= 0 || !writable) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50 px-4 py-2">
      <p className="text-sm text-slate-600">
        Đã chọn <span className="font-medium">{selectedCount}</span>{' '}
        {entityLabel}
      </p>
      <div className="flex gap-2">
        <Button type="button" size="sm" variant="ghost" onClick={onClear}>
          Bỏ chọn
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              disabled={deleting}
            >
              <Trash2 className="h-4 w-4" />
              Xóa đã chọn
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Xóa {selectedCount} {entityLabel}?
              </AlertDialogTitle>
              <AlertDialogDescription>
                Các bản ghi được xóa mềm. Bạn có thể nhập lại từ CSV nếu cần
                khôi phục.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Hủy</AlertDialogCancel>
              <AlertDialogAction
                disabled={deleting}
                onClick={() => void onConfirmDelete()}
              >
                Xóa
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
