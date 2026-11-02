'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { ContractFormDialog } from '@/components/contracts/contract-form-dialog';
import type { Contract, ContractKind } from '@/lib/types';
import { CONTRACT_KINDS } from '@/lib/types';
import { formatCurrencyVND, formatDate } from '@/lib/format';
import { formatContractTypesDisplay } from '@/lib/contract-type';
import { contractKindLabel, isExpenseContractKind } from '@/lib/contract-kind';
import {
  ContractExpiryBadge,
  contractExpiryRowClass,
} from '@/components/contracts/contract-expiry-highlight';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ContractStatusBadge,
  billingCycleLabel,
} from '@/components/shared/status-badges';
import { WriteOnly } from '@/components/auth/auth-provider';

/** HĐ của dự án, chia 3 nhóm: CĐT (thu) / thầu phụ / NCC (chi) */
export function ProjectContractsSection({
  projectId,
  contracts,
  onChanged,
}: {
  projectId: string;
  contracts: Contract[];
  /** Sau khi thêm HĐ trong popup */
  onChanged: () => void;
}) {
  const [createKind, setCreateKind] = useState<ContractKind | null>(null);
  const byKind = new Map<ContractKind, Contract[]>(
    CONTRACT_KINDS.map((kind) => [
      kind,
      contracts.filter((c) => (c.kind ?? 'INVESTOR') === kind),
    ]),
  );

  return (
    <>
      <ContractFormDialog
        open={createKind != null}
        onOpenChange={(open) => {
          if (!open) setCreateKind(null);
        }}
        defaultKind={createKind ?? 'INVESTOR'}
        defaultProjectId={projectId}
        onSaved={onChanged}
      />
      {CONTRACT_KINDS.map((kind) => {
        const rows = byKind.get(kind) ?? [];
        const expense = isExpenseContractKind(kind);
        return (
          <Card key={kind}>
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <CardTitle className="text-base">
                {contractKindLabel[kind]}
                <span className="ml-2 text-sm font-normal text-slate-500">
                  ({rows.length})
                </span>
              </CardTitle>
              <WriteOnly>
                <Button
                  size="sm"
                  variant={expense ? 'outline' : 'default'}
                  onClick={() => setCreateKind(kind)}
                >
                  <Plus className="h-4 w-4" />
                  Thêm {contractKindLabel[kind]}
                </Button>
              </WriteOnly>
            </CardHeader>
            <CardContent>
              {rows.length === 0 ? (
                <p className="text-sm text-slate-500">Chưa có hợp đồng.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Số hợp đồng</TableHead>
                        <TableHead>Tên hợp đồng</TableHead>
                        <TableHead>Công ty</TableHead>
                        {expense ? <TableHead>Đối tác</TableHead> : null}
                        <TableHead>Giá trị</TableHead>
                        <TableHead>Loại hợp đồng</TableHead>
                        <TableHead>Ngày ký</TableHead>
                        <TableHead>Chu kỳ nghiệm thu</TableHead>
                        <TableHead>Ngày kết thúc</TableHead>
                        <TableHead>Thời hạn</TableHead>
                        <TableHead>Trạng thái HĐ</TableHead>
                        <TableHead className="text-right">Thao tác</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((contract) => (
                        <TableRow
                          key={contract.id}
                          className={contractExpiryRowClass(
                            contract.endDate,
                            contract.status,
                          )}
                        >
                          <TableCell className="font-medium">
                            <Link
                              href={`/contracts/${contract.id}`}
                              className="underline-offset-2 hover:text-slate-950 hover:underline"
                            >
                              {contract.contractNo}
                            </Link>
                          </TableCell>
                          <TableCell>
                            <Link
                              href={`/contracts/${contract.id}`}
                              className="underline-offset-2 hover:text-slate-950 hover:underline"
                            >
                              {contract.name}
                            </Link>
                          </TableCell>
                          <TableCell>{contract.company?.code ?? '—'}</TableCell>
                          {expense ? (
                            <TableCell>
                              {contract.counterparty
                                ? `${contract.counterparty.code} — ${contract.counterparty.name}`
                                : '—'}
                            </TableCell>
                          ) : null}
                          <TableCell>
                            {formatCurrencyVND(contract.contractValue)}
                          </TableCell>
                          <TableCell>
                            {formatContractTypesDisplay(contract.contractType)}
                          </TableCell>
                          <TableCell>{formatDate(contract.signedDate)}</TableCell>
                          <TableCell>
                            {billingCycleLabel[contract.billingCycle]}
                          </TableCell>
                          <TableCell className="text-xs tabular-nums text-slate-600">
                            {formatDate(contract.endDate)}
                          </TableCell>
                          <TableCell>
                            <ContractExpiryBadge
                              endDate={contract.endDate}
                              status={contract.status}
                            />
                          </TableCell>
                          <TableCell>
                            <ContractStatusBadge status={contract.status} />
                          </TableCell>
                          <TableCell>
                            <div className="flex justify-end">
                              <Button asChild size="sm" variant="outline">
                                <Link href={`/contracts/${contract.id}`}>
                                  Xem hợp đồng
                                </Link>
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </>
  );
}
