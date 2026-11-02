'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

/** Chuyển link chi tiết cũ về workspace + popup. */
export default function ProjectReportSubmissionLegacyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === 'string' ? params.id : '';

  useEffect(() => {
    if (!id) {
      router.replace('/projects/report-submissions');
      return;
    }
    router.replace(
      `/projects/report-submissions?submissionId=${encodeURIComponent(id)}`,
    );
  }, [id, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-teal-50 text-sm text-slate-600">
      Đang mở báo cáo…
    </div>
  );
}
