'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { toast } from 'sonner';
import { acceptanceAttachmentsApi } from '@/lib/api';
import { formatDate } from '@/lib/format';
import type {
  AcceptanceAttachment,
  AcceptanceAttachmentKind,
} from '@/lib/types';
import {
  ACCEPTANCE_ATTACHMENT_KINDS,
  acceptanceAttachmentKindLabel,
} from '@/lib/types';
import { AttachmentFileActions } from '@/components/shared/attachment-file-actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { WriteOnly } from '@/components/auth/auth-provider';

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const KIND_ORDER: AcceptanceAttachmentKind[] = [
  'MINUTES',
  'VOLUME',
  'INVOICE',
];

export function AcceptanceAttachmentsPanel({
  acceptanceId,
  acceptanceNo,
}: {
  acceptanceId: string;
  acceptanceNo: string;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<AcceptanceAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [kind, setKind] = useState<AcceptanceAttachmentKind>('MINUTES');
  const [note, setNote] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await acceptanceAttachmentsApi.list(acceptanceId);
      setItems(data);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Không tải được tệp đính kèm',
      );
    } finally {
      setLoading(false);
    }
  }, [acceptanceId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error('Chọn tệp để tải lên');
      return;
    }
    if (uploading) return;
    setUploading(true);
    try {
      await acceptanceAttachmentsApi.upload(acceptanceId, {
        file: selectedFile,
        kind,
        note: note || undefined,
      });
      toast.success('Đã tải lên tệp');
      setSelectedFile(null);
      setNote('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Tải lên thất bại', {
        duration: 8000,
      });
    } finally {
      setUploading(false);
    }
    await load();
  };

  const handleDelete = async (id: string) => {
    try {
      await acceptanceAttachmentsApi.remove(id);
      toast.success('Đã xóa tệp');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Xóa thất bại');
    }
  };

  const grouped = KIND_ORDER.map((k) => ({
    kind: k,
    label: acceptanceAttachmentKindLabel[k],
    files: items.filter((item) => item.kind === k),
  }));

  return (
    <div className="mt-4 space-y-4 border-t border-slate-200 pt-4">
      <div>
        <p className="text-sm font-medium text-slate-800">
          Đính kèm nghiệm thu — {acceptanceNo}
        </p>
        <p className="text-xs text-slate-500">
          3 loại: Biên bản NT · Khối lượng · Hóa đơn (PDF/Word/Excel/ảnh, tối đa
          1GB)
        </p>
      </div>

      <WriteOnly>
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label>Loại tệp</Label>
              <Select
                value={kind}
                onChange={(e) =>
                  setKind(e.target.value as AcceptanceAttachmentKind)
                }
              >
                {ACCEPTANCE_ATTACHMENT_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {acceptanceAttachmentKindLabel[k]}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Chọn tệp</Label>
              <Input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <div className="flex items-end">
              <Button
                type="button"
                className="w-full"
                disabled={uploading || !selectedFile}
                onClick={() => void handleUpload()}
              >
                <Upload className="h-4 w-4" />
                {uploading ? 'Đang tải...' : 'Tải lên'}
              </Button>
            </div>
          </div>
          <div className="mt-3 space-y-1.5">
            <Label>Ghi chú (tuỳ chọn)</Label>
            <Textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Mô tả ngắn về tệp..."
            />
          </div>
        </div>
      </WriteOnly>

      {loading ? (
        <p className="text-sm text-slate-500">Đang tải danh sách tệp...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-slate-500">Chưa có tệp đính kèm cho đợt này.</p>
      ) : (
        <div className="space-y-4">
          {grouped.map(
            (group) =>
              group.files.length > 0 && (
                <div key={group.kind} className="space-y-2">
                  <h4 className="text-sm font-semibold text-slate-800">
                    {group.label} ({group.files.length})
                  </h4>
                  <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
                    {group.files.map((file) => (
                      <li key={file.id} className="px-3 py-2.5">
                        <AttachmentFileActions
                          file={{
                            id: file.id,
                            fileName: file.fileName,
                            mimeType: file.mimeType,
                          }}
                          downloadPath={`/acceptance-attachments/${file.id}/download`}
                          meta={
                            <>
                              {formatFileSize(file.sizeBytes)} ·{' '}
                              {formatDate(file.createdAt)}
                              {file.note ? ` · ${file.note}` : ''}
                            </>
                          }
                          onDelete={() => void handleDelete(file.id)}
                          deleteTitle="Xóa tệp?"
                          deleteDescription={`Xóa "${file.fileName}".`}
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              ),
          )}
        </div>
      )}
    </div>
  );
}
