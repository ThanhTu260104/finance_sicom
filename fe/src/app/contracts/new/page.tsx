import { Suspense } from 'react';
import { ContractFormWithSearchParams } from '@/components/contracts/contract-form';
import { Breadcrumbs } from '@/components/layout/breadcrumbs';

export default function NewContractPage() {
  return (
    <div className="space-y-4">
      <Breadcrumbs
        items={[
          { label: 'Quản lý dự án' },
          { label: 'Hợp đồng', href: '/contracts' },
          { label: 'Thêm hợp đồng' },
        ]}
      />
      <h2 className="font-serif text-2xl font-semibold">Thêm hợp đồng</h2>
      <Suspense fallback={<div className="p-8 text-slate-500">Đang tải...</div>}>
        <ContractFormWithSearchParams />
      </Suspense>
    </div>
  );
}
