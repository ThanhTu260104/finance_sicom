'use client';

import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { apiDownloadBlob } from '@/lib/api/client';
import { triggerBrowserDownload } from '@/lib/attachment-preview';
import { Button } from '@/components/ui/button';

export function ReportSubmissionFileDownload({
  fileId,
  fileName,
  sizeBytes,
  variant = 'link',
  className,
}: {
  fileId: string;
  fileName: string;
  sizeBytes: number;
  /** link = chi tiết dialog; button = danh sách ngoài */
  variant?: 'link' | 'button';
  className?: string;
}) {
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const blob = await apiDownloadBlob(
        `/project-report-submission-files/${fileId}/download`,
        { timeoutMs: 120_000 },
      );
      triggerBrowserDownload(blob, fileName);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Không tải được file báo cáo',
      );
    } finally {
      setLoading(false);
    }
  };

  const icon = loading ? (
    <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
  ) : (
    <Download className="h-3.5 w-3.5 shrink-0" />
  );

  if (variant === 'button') {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={className}
        disabled={loading}
        title={fileName}
        onClick={(e) => {
          e.stopPropagation();
          void handleDownload();
        }}
      >
        {icon}
        <span className="max-w-[9rem] truncate">{fileName}</span>
        <span className="text-[10px] font-normal text-slate-500">
          {Math.round(sizeBytes / 1024)} KB
        </span>
      </Button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="link"
        className="h-auto p-0 text-teal-800"
        disabled={loading}
        onClick={() => void handleDownload()}
      >
        {loading ? (
          <Loader2 className="mr-1 h-4 w-4 animate-spin" />
        ) : (
          <Download className="mr-1 h-4 w-4" />
        )}
        {fileName}
      </Button>
      <span className="text-xs text-slate-500">
        ({Math.round(sizeBytes / 1024)} KB)
      </span>
    </div>
  );
}
