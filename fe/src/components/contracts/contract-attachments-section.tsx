'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Download, FileText, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { contractAttachmentsApi } from '@/lib/api';
import { formatDate } from '@/lib/format';
import type { ContractAttachment, ContractAttachmentKind } from '@/lib/types';
import {
  CONTRACT_ATTACHMENT_KINDS,
  contractAttachmentKindLabel,
} from '@/lib/types';
import { ConfirmDeleteButton } from '@/components/shared/confirm-delete-button';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const KIND_ORDER: ContractAttachmentKind[] = [
  'CONTRACT',
  'APPENDIX',
  'OTHER',
];

export function ContractAttachmentsSection({
  contractId,
}: {
  contractId: string;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<ContractAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [kind, setKind] = useState<ContractAttachmentKind>('CONTRACT');
  const [note, setNote] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await contractAttachmentsApi.list(contractId);
      setItems(data);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Không tải được tệp đính kèm',
      );
    } finally {
      setLoading(false);
    }
  }, [contractId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error('Chọn tệp để tải lên');
      return;
    }
    setUploading(true);
    try {
      await contractAttachmentsApi.upload(contractId, {
        file: selectedFile,
        kind,
        note: note || undefined,
      });
      toast.success('Đã tải lên tệp');
      setSelectedFile(null);
      setNote('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Tải lên thất bại');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await contractAttachmentsApi.remove(id);
      toast.success('Đã xóa tệp');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Xóa thất bại');
    }
  };

  const grouped = KIND_ORDER.map((k) => ({
    kind: k,
    label: contractAttachmentKindLabel[k],
    files: items.filter((item) => item.kind === k),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Tệp đính kèm hợp đồng</CardTitle>
        <p className="text-sm text-slate-500">
          PDF, Word, Excel, hình ảnh — tối đa 20MB mỗi tệp
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4">
          <p className="mb-3 text-sm font-medium text-slate-800">
            Tải lên tệp mới
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label htmlFor="attachment-kind">Loại tệp</Label>
              <Select
                id="attachment-kind"
                value={kind}
                onChange={(e) =>
                  setKind(e.target.value as ContractAttachmentKind)
                }
              >
                {CONTRACT_ATTACHMENT_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {contractAttachmentKindLabel[k]}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="attachment-file">Chọn tệp</Label>
              <Input
                id="attachment-file"
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                onChange={(e) =>
                  setSelectedFile(e.target.files?.[0] ?? null)
                }
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
            <Label htmlFor="attachment-note">Ghi chú (tuỳ chọn)</Label>
            <Textarea
              id="attachment-note"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Mô tả ngắn về tệp..."
            />
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-slate-500">Đang tải danh sách tệp...</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-slate-500">Chưa có tệp đính kèm.</p>
        ) : (
          <div className="space-y-5">
            {grouped.map(
              (group) =>
                group.files.length > 0 && (
                  <div key={group.kind} className="space-y-2">
                    <h4 className="text-sm font-semibold text-slate-800">
                      {group.label} ({group.files.length})
                    </h4>
                    <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                      {group.files.map((file) => (
                        <li
                          key={file.id}
                          className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="flex min-w-0 items-start gap-2">
                            <FileText className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-slate-900">
                                {file.fileName}
                              </p>
                              <p className="text-xs text-slate-500">
                                {formatFileSize(file.sizeBytes)} ·{' '}
                                {formatDate(file.createdAt)}
                                {file.note ? ` · ${file.note}` : ''}
                              </p>
                            </div>
                          </div>
                          <div className="flex shrink-0 gap-2">
                            <Button asChild size="sm" variant="outline">
                              <a
                                href={contractAttachmentsApi.downloadUrl(
                                  file.id,
                                )}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <Download className="h-4 w-4" />
                                Tải về
                              </a>
                            </Button>
                            <ConfirmDeleteButton
                              onConfirm={() => handleDelete(file.id)}
                              title="Xóa tệp?"
                              description={`Xóa "${file.fileName}" khỏi hợp đồng.`}
                            />
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ),
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
