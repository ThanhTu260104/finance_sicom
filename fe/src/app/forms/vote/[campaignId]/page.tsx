'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

/** Chuyển sang trang nghe + bình chọn trong đợt. */
export default function PublicVoteRedirectPage() {
  const params = useParams<{ campaignId: string }>();
  const router = useRouter();
  const campaignId = params.campaignId?.trim();

  useEffect(() => {
    if (!campaignId) {
      router.replace('/forms/nghe-nhac');
      return;
    }
    router.replace(
      `/forms/nghe-nhac?campaignId=${encodeURIComponent(campaignId)}`,
    );
  }, [campaignId, router]);

  return (
    <div className="flex min-h-screen items-center justify-center text-sm text-slate-600">
      Đang chuyển tới trang bình chọn…
    </div>
  );
}
