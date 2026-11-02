'use client';

import { Suspense } from 'react';
import { PresentationView } from '@/components/dashboard/presentation/presentation-view';

export default function PresentationPage() {
  return (
    <Suspense
      fallback={
        <p className="flex min-h-screen items-center justify-center bg-slate-950 text-sm text-slate-400">
          Đang mở trình chiếu…
        </p>
      }
    >
      <PresentationView />
    </Suspense>
  );
}
