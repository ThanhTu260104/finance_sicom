'use client';

import { useParams } from 'next/navigation';
import { FinancialControlView } from '@/components/contracts/financial-control-view';

export default function ContractFinancialControlPage() {
  const params = useParams<{ id: string }>();
  return <FinancialControlView contractId={params.id} />;
}
