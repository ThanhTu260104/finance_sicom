'use client';

import type { Contract, ContractKind } from '@/lib/types';
import { contractKindLabel } from '@/lib/contract-kind';
import {
  ContractForm,
  contractFormDescription,
} from '@/components/contracts/contract-form';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

/**
 * Thêm / sửa HĐ trong popup (không chuyển trang).
 * `contract` có giá trị → sửa; không có → tạo mới theo `defaultKind`.
 */
export function ContractFormDialog({
  open,
  onOpenChange,
  contract,
  defaultKind = 'INVESTOR',
  defaultProjectId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contract?: Contract | null;
  defaultKind?: ContractKind;
  defaultProjectId?: string;
  onSaved: (contract: Contract) => void;
}) {
  const kind = contract?.kind ?? defaultKind;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {contract
              ? `Sửa ${contractKindLabel[kind]} · ${contract.contractNo}`
              : `Thêm ${contractKindLabel[kind]}`}
          </DialogTitle>
          <DialogDescription>{contractFormDescription(kind)}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          {open ? (
            <ContractForm
              // remount khi đổi HĐ → form nhận lại giá trị ban đầu
              key={contract?.id ?? `new-${kind}-${defaultProjectId ?? ''}`}
              variant="plain"
              contractId={contract?.id}
              initial={contract ?? undefined}
              defaultKind={kind}
              defaultProjectId={defaultProjectId}
              onSaved={(saved) => {
                onOpenChange(false);
                onSaved(saved);
              }}
              onCancel={() => onOpenChange(false)}
            />
          ) : null}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
