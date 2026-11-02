'use client';

import { Suspense } from 'react';
import { QuickEntryView } from '@/components/quick-entry/quick-entry-view';

export default function QuickEntryPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6 text-sm text-slate-500">Đang tải nhập nhanh…</div>
      }
    >
      <QuickEntryView />
    </Suspense>
  );
}
