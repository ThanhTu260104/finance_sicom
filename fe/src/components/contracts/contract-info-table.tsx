'use client';

import Link from 'next/link';
import type { Contract } from '@/lib/types';
import { formatCurrencyVND, formatDate } from '@/lib/format';
import { formatContractTypesDisplay } from '@/lib/contract-type';
import {
  contractKindLabel,
  isExpenseContractKind,
  partnerTypeLabel,
} from '@/lib/contract-kind';
import {
  ContractStatusBadge,
  billingCycleLabel,
} from '@/components/shared/status-badges';
import {
  KeyValueTable,
  type KeyValueRow,
} from '@/components/shared/key-value-table';

export function buildContractInfoRows(contract: Contract): KeyValueRow[] {
  const kind = contract.kind ?? 'INVESTOR';
  return [
    { label: 'Số hợp đồng', value: contract.contractNo },
    { label: 'Tên hợp đồng', value: contract.name },
    { label: 'Nhóm hợp đồng', value: contractKindLabel[kind] },
    {
      label: 'Công ty ký',
      value: contract.company
        ? `${contract.company.code} — ${contract.company.name}`
        : '—',
    },
    ...(isExpenseContractKind(kind)
      ? [
          {
            label: partnerTypeLabel[kind],
            value: contract.counterparty
              ? `${contract.counterparty.code} — ${contract.counterparty.name}`
              : '—',
          },
        ]
      : []),
    {
      label: 'Dự án',
      value: contract.project ? (
        <Link
          href={`/projects/${contract.project.id}`}
          className="font-semibold underline-offset-2 hover:underline"
        >
          {contract.project.code} — {contract.project.name}
        </Link>
      ) : (
        '—'
      ),
    },
    {
      label: 'Giá trị hợp đồng',
      value: formatCurrencyVND(contract.contractValue),
    },
    {
      label: 'Loại hợp đồng',
      value: formatContractTypesDisplay(contract.contractType),
    },
    {
      label: 'Chu kỳ nghiệm thu',
      value: contract.billingCycle
        ? billingCycleLabel[contract.billingCycle]
        : '—',
    },
    {
      label: 'Thời hạn HĐ',
      value:
        contract.durationYears != null && contract.durationYears > 0
          ? `${contract.durationYears} năm (dashboard tính số lần NT cùng chu kỳ trên)`
          : '—',
    },
    {
      label: 'Hạn thanh toán',
      value: `${contract.paymentTermDays ?? 0} ngày sau khi nộp hồ sơ`,
    },
    { label: 'Ngày ký', value: formatDate(contract.signedDate) },
    { label: 'Ngày bắt đầu', value: formatDate(contract.startDate) },
    { label: 'Ngày kết thúc', value: formatDate(contract.endDate) },
    {
      label: 'Trạng thái',
      value: <ContractStatusBadge status={contract.status} />,
    },
    { label: 'Ghi chú', value: contract.note || '—' },
  ];
}

export function ContractInfoTable({
  contract,
  compact = true,
}: {
  contract: Contract;
  compact?: boolean;
}) {
  return (
    <KeyValueTable
      compact={compact}
      showHeader={false}
      rows={buildContractInfoRows(contract)}
    />
  );
}
