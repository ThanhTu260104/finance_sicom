'use client';

import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { musicVotingApi } from '@/lib/api';
import {
  downloadCampaignTracksTemplate,
  parseSongCodesFromExcelFile,
} from '@/lib/music-voting-excel';
import { Button } from '@/components/ui/button';

export function CampaignTracksExcelImport({
  campaignId,
  onImported,
}: {
  campaignId: string;
  onImported: () => void | Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);

  async function onFile(file: File | undefined) {
    if (!file || !campaignId) return;
    setLoading(true);
    try {
      const codes = await parseSongCodesFromExcelFile(file);
      if (codes.length === 0) {
        toast.error('Không tìm thấy mã ca khúc trong file');
        return;
      }
      const res = await musicVotingApi.importCampaignTrackCodes(
        campaignId,
        codes,
      );
      toast.success(`Đã gán ${res.imported} ca khúc vào đợt bình chọn`);
      if (res.missingCodes?.length) {
        toast.message(
          `Mã không khớp (${res.missingCodes.length}): ${res.missingCodes.slice(0, 8).join(', ')}${res.missingCodes.length > 8 ? '…' : ''}`,
        );
      }
      await onImported();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Import Excel thất bại');
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 pt-3">
      <p className="w-full text-xs text-slate-600">
        Import Excel cột <strong>maCaKhuc</strong> — danh sách bài nhân viên
        được bình chọn trong đợt này.
      </p>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => downloadCampaignTracksTemplate()}
      >
        Tải mẫu Excel
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={loading}
        onClick={() => inputRef.current?.click()}
      >
        {loading ? 'Đang import…' : 'Upload Excel bình chọn'}
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={(e) => void onFile(e.target.files?.[0])}
      />
    </div>
  );
}
