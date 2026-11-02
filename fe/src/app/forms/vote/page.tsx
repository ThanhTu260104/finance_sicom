'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Toaster } from 'sonner';
import { PublicVotePanel } from '@/components/music-voting/public-vote-panel';

function VoteBallotContent() {
  const searchParams = useSearchParams();
  const campaignId = searchParams.get('campaignId')?.trim() || undefined;
  return <PublicVotePanel loadMode={{ kind: 'ballot', campaignId }} />;
}

export default function PublicVoteBallotPage() {
  return (
    <>
      <Toaster richColors position="top-center" />
      <div className="min-h-screen bg-slate-50 py-8">
        <div className="mx-auto max-w-lg space-y-4 px-4">
          <Suspense fallback={<p className="text-sm text-slate-600">Đang tải…</p>}>
            <VoteBallotContent />
          </Suspense>
        </div>
      </div>
    </>
  );
}
