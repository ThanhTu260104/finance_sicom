'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

type LoadMode =
  | { kind: 'ballot'; campaignId?: string }
  | { kind: 'campaign'; campaignId: string };

/** Legacy embed — chuyển sang trang nghe nhạc trong đợt. */
export function PublicVotePanel({ loadMode }: { loadMode: LoadMode }) {
  const router = useRouter();
  const campaignId =
    loadMode.kind === 'campaign'
      ? loadMode.campaignId
      : loadMode.campaignId?.trim();

  useEffect(() => {
    if (campaignId) {
      router.replace(
        `/forms/nghe-nhac?campaignId=${encodeURIComponent(campaignId)}`,
      );
    } else {
      router.replace('/forms/nghe-nhac');
    }
  }, [campaignId, router]);

  return (
    <div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-600">
      Đang chuyển tới trang nghe và bình chọn…
    </div>
  );
}
