'use client';

import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { musicVotingApi } from '@/lib/api';
import {
  downloadCampaignVotersTemplate,
  parseVotersFromExcelFile,
} from '@/lib/music-voting-excel';
import { Button } from '@/components/ui/button';

export function CampaignVotersExcelImport({
  campaignId,
  voterCount,
  onImported,
}: {
  campaignId: string;
  voterCount?: number;
  onImported: () => void | Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [clearing, setClearing] = useState(false);

  async function onFile(file: File | undefined) {
    if (!file || !campaignId) return;
    setLoading(true);
    try {
      const voters = await parseVotersFromExcelFile(file);
      if (voters.length === 0) {
        toast.error('Không tìm thấy dòng hợp lệ trong file');
        return;
      }
      if (voters.some((v) => !v.email?.trim())) {
        toast.error('Mỗi dòng cần cột email (và hoTen khớp khi bình chọn)');
        return;
      }
      const res = await musicVotingApi.importCampaignVoters(campaignId, voters);
      toast.success(`Đã import ${res.imported} nhân viên được bình chọn`);
      if (res.missingInEmployeeMaster?.length) {
        toast.message(
          `Mã chưa có trong danh mục NV (${res.missingInEmployeeMaster.length}): ${res.missingInEmployeeMaster.slice(0, 6).join(', ')}${res.missingInEmployeeMaster.length > 6 ? '…' : ''} — vẫn được thêm vào whitelist`,
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

  async function clearAll() {
    if (!campaignId) return;
    if (!window.confirm('Xóa toàn bộ whitelist nhân viên của đợt này?')) return;
    setClearing(true);
    try {
      const res = await musicVotingApi.clearCampaignVoters(campaignId);
      toast.success(`Đã xóa ${res.removed} dòng whitelist`);
      await onImported();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Không xóa được whitelist');
    } finally {
      setClearing(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 pt-3">
      <p className="w-full text-xs text-slate-600">
        Whitelist nhân viên — cột <strong>email</strong>, <strong>hoTen</strong>{' '}
        (tùy chọn <strong>maNhanVien</strong>). Chỉ người trong file mới bình
        chọn được. Hiện có:{' '}
        <strong>{voterCount ?? 0}</strong> người.
      </p>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => downloadCampaignVotersTemplate()}
      >
        Tải mẫu Excel NV
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={loading}
        onClick={() => inputRef.current?.click()}
      >
        {loading ? 'Đang import…' : 'Upload whitelist nhân viên'}
      </Button>
      {(voterCount ?? 0) > 0 ? (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="text-red-700"
          disabled={clearing}
          onClick={() => void clearAll()}
        >
          {clearing ? 'Đang xóa…' : 'Xóa whitelist'}
        </Button>
      ) : null}
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
