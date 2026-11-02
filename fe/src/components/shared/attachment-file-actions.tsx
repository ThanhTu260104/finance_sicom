'use client';

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Download, Eye, FileText, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { apiDownloadBlob } from '@/lib/api/client';
import {
  attachmentPreviewMode,
  triggerBrowserDownload,
} from '@/lib/attachment-preview';
import { ConfirmDeleteButton } from '@/components/shared/confirm-delete-button';
import { Button } from '@/components/ui/button';

export type AttachmentFileInfo = {
  id: string;
  fileName: string;
  mimeType: string;
};

type PreviewState = {
  blobUrl: string;
  mode: 'pdf' | 'image' | 'none';
};

export function AttachmentFileActions({
  file,
  downloadPath,
  meta,
  onDelete,
  deleteTitle,
  deleteDescription,
}: {
  file: AttachmentFileInfo;
  /** Path API, vd. `/attachments/:id/download` */
  downloadPath: string;
  meta?: ReactNode;
  onDelete: () => void;
  deleteTitle: string;
  deleteDescription: string;
}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const blobUrlRef = useRef<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [loadingDownload, setLoadingDownload] = useState(false);
  const [preview, setPreview] = useState<PreviewState | null>(null);

  const revokeBlobUrl = useCallback(() => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
  }, []);

  const closePreview = useCallback(() => {
    dialogRef.current?.close();
    setPreview(null);
    revokeBlobUrl();
  }, [revokeBlobUrl]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const onClose = () => {
      setPreview(null);
      revokeBlobUrl();
    };
    dialog.addEventListener('close', onClose);
    return () => dialog.removeEventListener('close', onClose);
  }, [revokeBlobUrl]);

  const fetchBlob = useCallback(async () => {
    return apiDownloadBlob(downloadPath, { timeoutMs: 120_000 });
  }, [downloadPath]);

  const openPreview = async () => {
    if (loadingPreview) return;
    setLoadingPreview(true);
    try {
      const raw = await fetchBlob();
      const blob =
        raw.type && raw.type !== 'application/octet-stream'
          ? raw
          : new Blob([raw], {
              type: file.mimeType || 'application/octet-stream',
            });
      const mode = attachmentPreviewMode(file.mimeType, file.fileName);
      revokeBlobUrl();
      const blobUrl = URL.createObjectURL(blob);
      blobUrlRef.current = blobUrl;
      setPreview({ blobUrl, mode });
      dialogRef.current?.showModal();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Không mở được tệp đính kèm',
      );
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleDownload = async () => {
    if (loadingDownload) return;
    setLoadingDownload(true);
    try {
      const blob = await fetchBlob();
      triggerBrowserDownload(blob, file.fileName);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Không tải được tệp đính kèm',
      );
    } finally {
      setLoadingDownload(false);
    }
  };

  return (
    <>
      <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-2">
          <FileText className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
          <div className="min-w-0">
            <button
              type="button"
              onClick={() => void openPreview()}
              disabled={loadingPreview}
              className="break-words text-left text-sm font-medium leading-snug text-slate-900 underline-offset-2 hover:text-blue-700 hover:underline disabled:opacity-60"
              title={file.fileName}
            >
              {file.fileName}
            </button>
            {meta ? (
              <div className="text-xs text-slate-500">{meta}</div>
            ) : null}
            {loadingPreview ? (
              <p className="text-xs text-slate-500">Đang mở tệp...</p>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={loadingPreview}
          onClick={() => void openPreview()}
        >
          {loadingPreview ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Eye className="h-4 w-4" />
          )}
          Xem
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={loadingDownload}
          onClick={() => void handleDownload()}
        >
          {loadingDownload ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          Tải về
        </Button>
        <ConfirmDeleteButton
          onConfirm={onDelete}
          title={deleteTitle}
          description={deleteDescription}
        />
        </div>
      </div>

      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        className="fixed inset-0 z-[100] m-0 h-[100dvh] max-h-[100dvh] w-[100vw] max-w-[100vw] border-0 bg-slate-900/70 p-0 backdrop:bg-slate-900/70 open:block"
        onCancel={(e) => {
          e.preventDefault();
          closePreview();
        }}
      >
        <div className="flex h-[100dvh] w-full flex-col bg-white">
          <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-4 py-3 sm:items-center">
            <h2
              id={titleId}
              className="min-w-0 flex-1 break-words text-sm font-medium leading-snug text-slate-900 sm:text-base"
            >
              {file.fileName}
            </h2>
            <div className="flex shrink-0 gap-2 pt-0.5 sm:pt-0">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={loadingDownload}
                onClick={() => void handleDownload()}
              >
                <Download className="h-4 w-4" />
                Tải về
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label="Đóng"
                onClick={closePreview}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>

          <div className="relative min-h-0 flex-1 bg-slate-200">
            {!preview ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
              </div>
            ) : preview.mode === 'pdf' ? (
              <object
                data={preview.blobUrl}
                type="application/pdf"
                aria-label={file.fileName}
                className="absolute inset-0 h-full w-full bg-white"
              >
                <iframe
                  title={file.fileName}
                  src={preview.blobUrl}
                  className="absolute inset-0 h-full w-full border-0 bg-white"
                />
              </object>
            ) : preview.mode === 'image' ? (
              <div className="absolute inset-0 flex items-center justify-center overflow-auto p-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={preview.blobUrl}
                  alt={file.fileName}
                  className="max-h-full max-w-full object-contain"
                />
              </div>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
                <p className="max-w-md text-sm text-slate-600">
                  Word / Excel chưa hỗ trợ xem trong trình duyệt.
                </p>
                <p className="text-sm text-slate-500">
                  Bấm <strong>Tải về</strong> để mở bằng Word, Excel hoặc ứng
                  dụng trên máy.
                </p>
                <Button
                  type="button"
                  onClick={() => void handleDownload()}
                  disabled={loadingDownload}
                >
                  <Download className="h-4 w-4" />
                  Tải về
                </Button>
              </div>
            )}
          </div>
        </div>
      </dialog>
    </>
  );
}
