'use client';

import Link from 'next/link';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { Contract, ContractStatus } from '@/lib/types';
import {
  CONTRACT_EXPIRING_WARN_DAYS,
  getContractExpiry,
  isClosedContract,
  splitContractsForHighlight,
  type ContractExpiry,
} from '@/lib/contract-expiry';
import { formatDate } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type HighlightContract = Pick<
  Contract,
  'id' | 'contractNo' | 'name' | 'status' | 'endDate'
>;

/** Badge thời hạn (theo ngày kết thúc) — khác với badge trạng thái HĐ */
export function ContractExpiryBadge({
  endDate,
  expiry,
  status,
}: {
  endDate?: string | null;
  expiry?: ContractExpiry;
  /** HĐ đã đóng (hoàn thành / thanh lý / hủy) → badge xám, không cảnh báo */
  status?: ContractStatus;
}) {
  const value = expiry ?? getContractExpiry(endDate);
  if (value.state === 'NO_END_DATE') {
    return <span className="text-xs text-slate-400">—</span>;
  }
  const variant =
    status && isClosedContract(status)
      ? 'muted'
      : value.state === 'EXPIRED'
      ? 'danger'
      : value.state === 'EXPIRING'
        ? 'warning'
        : 'muted';
  return (
    <Badge variant={variant} className="whitespace-nowrap">
      {value.label}
    </Badge>
  );
}

/** Nền dòng bảng theo thời hạn — HĐ đã đóng không tô */
export function contractExpiryRowClass(
  endDate: string | null | undefined,
  status: ContractStatus,
) {
  if (isClosedContract(status)) return undefined;
  const { state } = getContractExpiry(endDate);
  return state === 'EXPIRED'
    ? 'bg-red-50/70 hover:bg-red-50'
    : state === 'EXPIRING'
      ? 'bg-amber-50/70 hover:bg-amber-50'
      : undefined;
}

function ContractLinkCell({
  contract,
  linkable,
}: {
  contract: HighlightContract;
  linkable: boolean;
}) {
  const text = (value: string) =>
    linkable ? (
      <Link
        href={`/contracts/${contract.id}`}
        className="underline-offset-2 hover:underline"
      >
        {value}
      </Link>
    ) : (
      value
    );
  return (
    <>
      <td className="whitespace-nowrap py-1.5 pr-3 align-top font-mono text-xs font-semibold">
        {text(contract.contractNo)}
      </td>
      <td className="py-1.5 pr-3 align-top text-sm text-slate-800">
        {text(contract.name)}
      </td>
    </>
  );
}

/**
 * Khối cảnh báo: HĐ hết hạn / sắp hết hạn (tính theo ngày kết thúc) tách riêng
 * khỏi HĐ đã chuyển trạng thái Hoàn thành.
 */
export function ContractExpiryHighlight({
  contracts,
  className,
  linkable = true,
}: {
  contracts: HighlightContract[];
  className?: string;
  /** false: số / tên HĐ không bấm được (tài khoản không xem được chi tiết) */
  linkable?: boolean;
}) {
  const { expiring, completed } = splitContractsForHighlight(contracts);
  if (expiring.length === 0 && completed.length === 0) return null;

  return (
    <div className={cn('grid gap-3 lg:grid-cols-2', className)}>
      <Card
        className={cn(
          'overflow-hidden',
          expiring.length > 0 && 'border-red-200 ring-1 ring-red-100',
        )}
      >
        <div
          className={cn(
            'flex items-center gap-2 border-b px-4 py-2.5',
            expiring.length > 0
              ? 'border-red-100 bg-red-50 text-red-800'
              : 'border-slate-100 bg-slate-50 text-slate-600',
          )}
        >
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <p className="text-sm font-semibold">
            Hết hạn / sắp hết hạn ({expiring.length})
          </p>
          <p className="ml-auto text-xs opacity-80">
            Theo ngày kết thúc · cảnh báo trước {CONTRACT_EXPIRING_WARN_DAYS} ngày
          </p>
        </div>
        <CardContent className="max-h-72 overflow-y-auto px-4 py-2">
          {expiring.length === 0 ? (
            <p className="py-2 text-sm text-slate-500">
              Không có HĐ nào hết hạn hoặc sắp hết hạn.
            </p>
          ) : (
            <table className="w-full">
              <tbody>
                {expiring.map(({ contract, expiry }) => (
                  <tr
                    key={contract.id}
                    className="border-b border-slate-100 last:border-0"
                  >
                    <ContractLinkCell contract={contract} linkable={linkable} />
                    <td className="py-1.5 text-right align-top">
                      <ContractExpiryBadge expiry={expiry} />
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        Kết thúc {formatDate(contract.endDate)}
                      </p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <div className="flex items-center gap-2 border-b border-emerald-100 bg-emerald-50 px-4 py-2.5 text-emerald-800">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <p className="text-sm font-semibold">
            Đã hoàn thành ({completed.length})
          </p>
          <p className="ml-auto text-xs opacity-80">
            HĐ đã chuyển trạng thái Hoàn thành
          </p>
        </div>
        <CardContent className="max-h-72 overflow-y-auto px-4 py-2">
          {completed.length === 0 ? (
            <p className="py-2 text-sm text-slate-500">
              Chưa có HĐ nào hoàn thành.
            </p>
          ) : (
            <table className="w-full">
              <tbody>
                {completed.map((contract) => (
                  <tr
                    key={contract.id}
                    className="border-b border-slate-100 last:border-0"
                  >
                    <ContractLinkCell contract={contract} linkable={linkable} />
                    <td className="py-1.5 text-right align-top">
                      <Badge variant="success" className="whitespace-nowrap">
                        Hoàn thành
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
