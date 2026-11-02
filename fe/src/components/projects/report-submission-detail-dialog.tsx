'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { projectReportSubmissionsApi } from '@/lib/api';
import type { ProjectReportSubmissionDetail } from '@/lib/types';
import { formatCurrencyVND, formatPeriod } from '@/lib/format';
import { ReportSubmissionFileDownload } from '@/components/projects/report-submission-file-download';
import { ConfirmDeleteButton } from '@/components/shared/confirm-delete-button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export function ReportSubmissionDetailDialog({
  submissionId,
  open,
  onOpenChange,
  onDeleted,
}: {
  submissionId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
}) {
  const [detail, setDetail] = useState<ProjectReportSubmissionDetail | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !submissionId) {
      setDetail(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    projectReportSubmissionsApi
      .get(submissionId)
      .then((d) => {
        if (!cancelled) setDetail(d);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Không tải được');
          setDetail(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, submissionId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90vh,720px)] max-w-2xl overflow-hidden p-0">
        <DialogHeader className="border-b border-slate-200 px-6 py-4">
          <DialogTitle className="text-left text-base">
            {detail
              ? (detail.title ??
                `Báo cáo ${detail.project.code} · ${formatPeriod(detail.period)}`)
              : 'Chi tiết báo cáo'}
          </DialogTitle>
          {detail ? (
            <p className="text-left text-sm font-normal text-slate-600">
              {detail.project.name} · nộp{' '}
              {new Date(detail.submittedAt).toLocaleString('vi-VN')}
            </p>
          ) : null}
        </DialogHeader>
        <DialogBody className="overflow-y-auto px-6 py-4">
          {loading ? (
            <p className="text-sm text-slate-500">Đang tải…</p>
          ) : error ? (
            <p className="text-sm text-red-600">{error}</p>
          ) : detail ? (
            <div className="space-y-4">
              {detail.note ? (
                <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
                  {detail.note}
                </p>
              ) : null}
              {detail.driveFolderUrl ? (
                <p className="text-sm">
                  <a
                    href={detail.driveFolderUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-teal-800 underline"
                  >
                    Thư mục Google Drive (tham chiếu)
                  </a>
                </p>
              ) : null}

              <div>
                <h3 className="mb-2 text-sm font-semibold text-slate-900">
                  Kế hoạch NT trong báo cáo
                </h3>
                <div className="space-y-2">
                  {detail.lines.map((line) => (
                    <div
                      key={line.id}
                      className="rounded-lg border border-slate-200 bg-slate-50/60 p-3 text-sm"
                    >
                      <p className="font-medium">{line.contractNo}</p>
                      <p className="text-slate-600">{line.contractName}</p>
                      <div className="mt-2 grid gap-1 sm:grid-cols-2">
                        <p>
                          <span className="text-slate-500">KH hệ thống: </span>
                          <span className="tabular-nums font-medium">
                            {line.systemPlannedAmountSnapshot != null
                              ? formatCurrencyVND(line.systemPlannedAmountSnapshot)
                              : '—'}
                          </span>
                        </p>
                        <p>
                          <span className="text-slate-500">KH báo cáo: </span>
                          <span className="tabular-nums font-semibold">
                            {formatCurrencyVND(line.reportedPlannedAmount)}
                          </span>
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="mb-2 text-sm font-semibold text-slate-900">
                  File đính kèm ({detail.files.length})
                </h3>
                {detail.files.length === 0 ? (
                  <p className="text-sm text-slate-500">Không có file.</p>
                ) : (
                  <ul className="space-y-2">
                    {detail.files.map((f) => (
                      <li key={f.id}>
                        <ReportSubmissionFileDownload
                          fileId={f.id}
                          fileName={f.fileName}
                          sizeBytes={f.sizeBytes}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="flex justify-end border-t border-slate-100 pt-4">
                <ConfirmDeleteButton
                  onConfirm={async () => {
                    try {
                      await projectReportSubmissionsApi.remove(detail.id);
                      toast.success('Đã xóa báo cáo');
                      onOpenChange(false);
                      onDeleted?.();
                    } catch (err) {
                      toast.error(
                        err instanceof Error ? err.message : 'Xóa thất bại',
                      );
                    }
                  }}
                  title="Xóa báo cáo này?"
                  description="Báo cáo sẽ không còn trong danh sách tháng."
                />
              </div>
            </div>
          ) : null}
        </DialogBody>
        <div className="border-t border-slate-200 px-6 py-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            Đóng
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
