'use client';

import type { DashboardExpiringContractRow } from '@/lib/types';
import { ExpiringContractsTable } from '@/components/dashboard/company/expiring-contracts-table';

export function DashboardActionLists({
  expiringContracts,
}: {
  expiringContracts: DashboardExpiringContractRow[];
}) {
  return <ExpiringContractsTable rows={expiringContracts} />;
}
