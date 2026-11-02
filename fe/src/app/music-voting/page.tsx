'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { musicVotingApi } from '@/lib/api';
import type {
  MusicTrack,
  VotingCampaign,
  VotingCampaignDetail,
  VotingCampaignStats,
} from '@/lib/api/music-voting';
import {
  MUSIC_TRACK_FILE_ACCEPT,
  MUSIC_TRACK_MAX_BYTES,
  publicTrackAudioUrl,
} from '@/lib/api/music-voting';
import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatDate } from '@/lib/format';
import { ConfirmDeleteButton } from '@/components/shared/confirm-delete-button';
import { CampaignTracksExcelImport } from '@/components/music-voting/campaign-tracks-excel-import';
import { CampaignVotersExcelImport } from '@/components/music-voting/campaign-voters-excel-import';
import { MusicVotingAdminShell } from '@/components/music-voting/music-voting-admin-shell';
import { MusicTrackEditDialog } from '@/components/music-voting/music-track-edit-dialog';

type Tab = 'tracks' | 'campaigns';

export default function MusicVotingAdminPage() {
  const [tab, setTab] = useState<Tab>('campaigns');
  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const [campaigns, setCampaigns] = useState<VotingCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCampaignId, setSelectedCampaignId] = useState('');
  const [detail, setDetail] = useState<VotingCampaignDetail | null>(null);
  const [stats, setStats] = useState<VotingCampaignStats | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [submittingTrack, setSubmittingTrack] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadingTrackId, setUploadingTrackId] = useState<string | null>(null);
  const reuploadInputRef = useRef<HTMLInputElement>(null);
  const reuploadTrackIdRef = useRef<string | null>(null);
  const [campaignTrackIds, setCampaignTrackIds] = useState<Set<string>>(
    new Set(),
  );
  const [savingCampaignTracks, setSavingCampaignTracks] = useState(false);
  const [selectedTrackIds, setSelectedTrackIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [editingTrack, setEditingTrack] = useState<MusicTrack | null>(null);

  const [trackForm, setTrackForm] = useState({
    songCode: '',
    contestantCode: '',
    performerName: '',
    authorName: '',
    songTitle: '',
  });

  const [campaignForm, setCampaignForm] = useState({
    name: '',
    startAt: '',
    endAt: '',
    maxTracksPerBallot: '1',
    status: 'DRAFT' as VotingCampaign['status'],
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [t, c] = await Promise.all([
        musicVotingApi.listTracks(),
        musicVotingApi.listCampaigns(),
      ]);
      setTracks(t);
      setCampaigns(c);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Không tải được dữ liệu');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const loadDetail = useCallback(async (id: string) => {
    if (!id) {
      setDetail(null);
      setStats(null);
      return;
    }
    try {
      const [d, s] = await Promise.all([
        musicVotingApi.getCampaign(id),
        musicVotingApi.getStats(id),
      ]);
      setDetail(d);
      setStats(s);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Không tải chi tiết đợt');
    }
  }, []);

  useEffect(() => {
    void loadDetail(selectedCampaignId);
  }, [selectedCampaignId, loadDetail]);

  useEffect(() => {
    if (!detail?.tracks) {
      setCampaignTrackIds(new Set());
      return;
    }
    setCampaignTrackIds(new Set(detail.tracks.map((x) => x.track.id)));
  }, [detail]);

  async function submitTrack(e: React.FormEvent) {
    e.preventDefault();
    if (!audioFile) {
      toast.error('Chọn file nhạc (mp3, wav, m4a, mp4, mov…)');
      return;
    }
    if (audioFile.size > MUSIC_TRACK_MAX_BYTES) {
      toast.error('File nhạc tối đa 100MB');
      return;
    }
    setSubmittingTrack(true);
    setUploadProgress(0);
    try {
      await musicVotingApi.createTrackWithAudio(
        audioFile,
        {
          ...trackForm,
          publicStatus: 'PUBLIC',
        },
        {
          onProgress: (pct) => setUploadProgress(pct),
        },
      );
      toast.success('Đã thêm ca khúc và upload nhạc');
      setTrackForm({
        songCode: '',
        contestantCode: '',
        performerName: '',
        authorName: '',
        songTitle: '',
      });
      setAudioFile(null);
      setFileInputKey((k) => k + 1);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Lỗi upload ca khúc');
    } finally {
      setSubmittingTrack(false);
      setUploadProgress(null);
    }
  }

  function promptReupload(trackId: string) {
    reuploadTrackIdRef.current = trackId;
    reuploadInputRef.current?.click();
  }

  function toggleTrackSelected(id: string, checked: boolean) {
    setSelectedTrackIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleAllTracksSelected(checked: boolean) {
    if (checked) setSelectedTrackIds(new Set(tracks.map((t) => t.id)));
    else setSelectedTrackIds(new Set());
  }

  const allTracksSelected =
    tracks.length > 0 && tracks.every((t) => selectedTrackIds.has(t.id));
  const someTracksSelected =
    tracks.some((t) => selectedTrackIds.has(t.id)) && !allTracksSelected;

  async function afterTracksDeleted() {
    setSelectedTrackIds(new Set());
    if (selectedCampaignId) {
      await loadDetail(selectedCampaignId);
    }
    await load();
  }

  async function deleteTrack(id: string, songTitle: string) {
    try {
      await musicVotingApi.deleteTrack(id);
      toast.success(`Đã xóa «${songTitle}»`);
      await afterTracksDeleted();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Không xóa được ca khúc');
    }
  }

  async function deleteSelectedTracks() {
    const ids = [...selectedTrackIds];
    if (ids.length === 0) return;
    try {
      const res = await musicVotingApi.bulkDeleteTracks(ids);
      if (res.failed.length === 0) {
        toast.success(`Đã xóa ${res.removed} ca khúc`);
      } else {
        toast.warning(
          `Xóa được ${res.removed}/${ids.length}. ${res.failed.length} bài lỗi.`,
        );
      }
      await afterTracksDeleted();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Không xóa hàng loạt được',
      );
    }
  }

  async function onReuploadFileSelected(file: File | undefined) {
    const trackId = reuploadTrackIdRef.current;
    reuploadTrackIdRef.current = null;
    if (!trackId || !file) return;
    if (file.size > MUSIC_TRACK_MAX_BYTES) {
      toast.error('File nhạc tối đa 100MB');
      return;
    }
    setUploadingTrackId(trackId);
    setUploadProgress(0);
    try {
      await musicVotingApi.uploadTrackAudio(trackId, file, {
        onProgress: (pct) => setUploadProgress(pct),
      });
      toast.success('Đã upload file nhạc');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Lỗi upload file');
    } finally {
      setUploadingTrackId(null);
      setUploadProgress(null);
    }
  }

  async function submitCampaign(e: React.FormEvent) {
    e.preventDefault();
    try {
      const row = await musicVotingApi.createCampaign({
        name: campaignForm.name,
        startAt: new Date(campaignForm.startAt).toISOString(),
        endAt: new Date(campaignForm.endAt).toISOString(),
        status: campaignForm.status,
        maxTracksPerBallot: Number(campaignForm.maxTracksPerBallot) || 0,
        resultPublishConfig: { publishAfterEnd: true },
      });
      toast.success('Đã tạo đợt bình chọn');
      setSelectedCampaignId(row.id);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Lỗi tạo đợt');
    }
  }

  async function activateCampaign(id: string) {
    try {
      await musicVotingApi.updateCampaign(id, { status: 'ACTIVE' });
      toast.success('Đã bật ACTIVE');
      await load();
      await loadDetail(id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Lỗi cập nhật');
    }
  }

  async function deleteCampaign(id: string) {
    try {
      await musicVotingApi.deleteCampaign(id);
      toast.success('Đã xóa đợt bình chọn');
      if (selectedCampaignId === id) {
        setSelectedCampaignId('');
        setDetail(null);
      }
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Không xóa được đợt');
    }
  }

  function toggleCampaignTrack(trackId: string) {
    setCampaignTrackIds((prev) => {
      const next = new Set(prev);
      if (next.has(trackId)) next.delete(trackId);
      else next.add(trackId);
      return next;
    });
  }

  async function saveCampaignTracks() {
    if (!selectedCampaignId) return;
    setSavingCampaignTracks(true);
    try {
      await musicVotingApi.setCampaignTracks(selectedCampaignId, [
        ...campaignTrackIds,
      ]);
      toast.success('Đã lưu danh sách bình chọn');
      await loadDetail(selectedCampaignId);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Lỗi lưu danh sách');
    } finally {
      setSavingCampaignTracks(false);
    }
  }

  const publicListenUrl =
    typeof window !== 'undefined'
      ? selectedCampaignId
        ? `${window.location.origin}/forms/nghe-nhac?campaignId=${selectedCampaignId}`
        : `${window.location.origin}/forms/nghe-nhac`
      : '';

  const publicVoteUrl =
    typeof window !== 'undefined'
      ? selectedCampaignId
        ? `${window.location.origin}/forms/vote/${selectedCampaignId}`
        : `${window.location.origin}/forms/vote`
      : '';

  return (
    <MusicVotingAdminShell>
    <div className="space-y-4 p-4 md:p-6">
      <Breadcrumbs
        items={[
          { label: 'Dashboard', href: '/' },
          { label: 'Bình chọn ca khúc' },
        ]}
      />
      {publicListenUrl ? (
        <p className="rounded-md border border-[#c9a962]/30 bg-[#0c2340]/5 px-3 py-2 text-sm text-[#0c2340]">
          {selectedCampaignId
            ? 'Link đợt (bài trong đợt + nút bình chọn):'
            : 'Link nghe toàn thư viện (không bình chọn):'}{' '}
          <a className="break-all underline" href={publicListenUrl}>
            {publicListenUrl}
          </a>
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={tab === 'campaigns' ? 'default' : 'outline'}
          size="sm"
          className={
            tab === 'campaigns'
              ? 'bg-[#0c2340] hover:bg-[#152d4a] text-[#f8f6f0]'
              : 'border-[#0c2340]/20'
          }
          onClick={() => setTab('campaigns')}
        >
          Đợt bình chọn
        </Button>
        <Button
          variant={tab === 'tracks' ? 'default' : 'outline'}
          size="sm"
          className={
            tab === 'tracks'
              ? 'bg-[#0c2340] hover:bg-[#152d4a] text-[#f8f6f0]'
              : 'border-[#0c2340]/20'
          }
          onClick={() => setTab('tracks')}
        >
          Ca khúc
        </Button>
      </div>

      {loading ? (
        <p className="p-8 text-center text-sm text-slate-500">Đang tải…</p>
      ) : tab === 'tracks' ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Thêm ca khúc</CardTitle>
            </CardHeader>
            <CardContent>
              <form className="space-y-2" onSubmit={submitTrack}>
                {(
                  [
                    ['songCode', 'Mã ca khúc'],
                    ['contestantCode', 'Mã thí sinh'],
                    ['performerName', 'Người trình bày'],
                    ['authorName', 'Tác giả'],
                    ['songTitle', 'Tên bài hát'],
                  ] as const
                ).map(([key, label]) => (
                  <div key={key}>
                    <label className="text-xs text-slate-600">{label}</label>
                    <Input
                      value={trackForm[key]}
                      onChange={(e) =>
                        setTrackForm((f) => ({ ...f, [key]: e.target.value }))
                      }
                      required
                    />
                  </div>
                ))}
                <div>
                  <label className="text-xs text-slate-600">File nhạc</label>
                  <Input
                    key={fileInputKey}
                    type="file"
                    accept={MUSIC_TRACK_FILE_ACCEPT}
                    required
                    disabled={submittingTrack}
                    onChange={(e) =>
                      setAudioFile(e.target.files?.[0] ?? null)
                    }
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    Nếu BE bật R2, file gửi thẳng Cloudflare (nhanh hơn qua máy
                    chủ). Thanh % chạy tới 100% rồi đợi vài giây xác nhận.
                  </p>
                </div>
                {uploadProgress != null ? (
                  <div className="space-y-1">
                    <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full bg-teal-600 transition-[width]"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                    <p className="text-xs text-slate-600">
                      Đang gửi file: {uploadProgress}%
                      {uploadProgress >= 100 ? ' — đang xử lý trên server…' : ''}
                    </p>
                  </div>
                ) : null}
                <Button type="submit" size="sm" disabled={submittingTrack}>
                  {submittingTrack ? 'Đang upload…' : 'Lưu & upload'}
                </Button>
              </form>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-base">
                Danh sách ({tracks.length})
              </CardTitle>
              {selectedTrackIds.size > 0 ? (
                <ConfirmDeleteButton
                  label={`Xóa đã chọn (${selectedTrackIds.size})`}
                  title="Xóa các ca khúc đã chọn?"
                  description={`Xóa vĩnh viễn ${selectedTrackIds.size} ca khúc và file nhạc. Bài sẽ được gỡ khỏi mọi đợt bình chọn và phiếu liên quan trước khi xóa.`}
                  onConfirm={() => void deleteSelectedTracks()}
                />
              ) : null}
            </CardHeader>
            <CardContent className="max-h-[28rem] overflow-auto">
              <input
                ref={reuploadInputRef}
                type="file"
                accept={MUSIC_TRACK_FILE_ACCEPT}
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  void onReuploadFileSelected(f);
                }}
              />
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <input
                        type="checkbox"
                        aria-label="Chọn tất cả ca khúc"
                        checked={allTracksSelected}
                        ref={(el) => {
                          if (el) el.indeterminate = someTracksSelected;
                        }}
                        onChange={(e) =>
                          toggleAllTracksSelected(e.target.checked)
                        }
                      />
                    </TableHead>
                    <TableHead>Mã</TableHead>
                    <TableHead>Bài hát</TableHead>
                    <TableHead>Thí sinh</TableHead>
                    <TableHead className="w-[140px] text-right"> </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tracks.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell>
                        <input
                          type="checkbox"
                          aria-label={`Chọn ${t.songTitle}`}
                          checked={selectedTrackIds.has(t.id)}
                          onChange={(e) =>
                            toggleTrackSelected(t.id, e.target.checked)
                          }
                        />
                      </TableCell>
                      <TableCell className="font-mono text-xs">{t.songCode}</TableCell>
                      <TableCell>
                        <div>{t.songTitle}</div>
                        {t.hasAudio ? (
                          <audio
                            className="mt-1 max-w-xs"
                            controls
                            preload="none"
                            src={publicTrackAudioUrl(t.id)}
                          />
                        ) : (
                          <div className="mt-1 space-y-1">
                            <span className="text-xs text-amber-700">
                              Chưa có file — bấm upload lại
                            </span>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={uploadingTrackId === t.id}
                              onClick={() => promptReupload(t.id)}
                            >
                              {uploadingTrackId === t.id
                                ? 'Đang upload…'
                                : 'Upload nhạc'}
                            </Button>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>{t.contestantCode}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-wrap justify-end gap-1">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setEditingTrack(t)}
                          >
                            Sửa
                          </Button>
                          <ConfirmDeleteButton
                            label="Xóa"
                            title="Xóa ca khúc?"
                            description={`Xóa vĩnh viễn «${t.songTitle}» và file nhạc. Bài sẽ được gỡ khỏi mọi đợt bình chọn và phiếu liên quan trước khi xóa.`}
                            onConfirm={() => void deleteTrack(t.id, t.songTitle)}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tạo đợt bình chọn</CardTitle>
            </CardHeader>
            <CardContent>
              <form className="space-y-2" onSubmit={submitCampaign}>
                <Input
                  placeholder="Tên đợt"
                  value={campaignForm.name}
                  onChange={(e) =>
                    setCampaignForm((f) => ({ ...f, name: e.target.value }))
                  }
                  required
                />
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    type="datetime-local"
                    value={campaignForm.startAt}
                    onChange={(e) =>
                      setCampaignForm((f) => ({ ...f, startAt: e.target.value }))
                    }
                    required
                  />
                  <Input
                    type="datetime-local"
                    value={campaignForm.endAt}
                    onChange={(e) =>
                      setCampaignForm((f) => ({ ...f, endAt: e.target.value }))
                    }
                    required
                  />
                </div>
                <Input
                  type="number"
                  min={0}
                  placeholder="Số bài tối đa / lượt (0 = không giới hạn)"
                  value={campaignForm.maxTracksPerBallot}
                  onChange={(e) =>
                    setCampaignForm((f) => ({
                      ...f,
                      maxTracksPerBallot: e.target.value,
                    }))
                  }
                />
                <Select
                  value={campaignForm.status}
                  onChange={(e) =>
                    setCampaignForm((f) => ({
                      ...f,
                      status: e.target.value as VotingCampaign['status'],
                    }))
                  }
                >
                  <option value="DRAFT">DRAFT</option>
                  <option value="ACTIVE">ACTIVE</option>
                </Select>
                <Button type="submit" size="sm">
                  Tạo đợt
                </Button>
              </form>
              <div className="mt-4 space-y-1">
                {campaigns.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={`block w-full rounded border px-2 py-1.5 text-left text-sm ${
                      selectedCampaignId === c.id
                        ? 'border-teal-600 bg-teal-50'
                        : 'border-slate-200'
                    }`}
                    onClick={() => setSelectedCampaignId(c.id)}
                  >
                    <span className="font-medium">{c.name}</span>
                    <span className="ml-2 text-xs text-slate-500">{c.status}</span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Chi tiết đợt</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {!detail ? (
                <p className="text-sm text-slate-500">Chọn một đợt bên trái.</p>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm">
                      {formatDate(detail.startAt)} → {formatDate(detail.endAt)}
                    </p>
                    {detail.status !== 'ACTIVE' ? (
                      <Button
                        size="sm"
                        onClick={() => void activateCampaign(detail.id)}
                      >
                        Bật ACTIVE
                      </Button>
                    ) : null}
                    <ConfirmDeleteButton
                      label="Xóa đợt"
                      title="Xóa đợt bình chọn?"
                      description={`Xóa «${detail.name}» và toàn bộ bài gán, whitelist nhân viên, phiếu bình chọn của đợt này. Không hoàn tác.`}
                      onConfirm={() => void deleteCampaign(detail.id)}
                    />
                  </div>
                  {publicVoteUrl ? (
                    <p className="break-all text-xs text-teal-800">
                      Gửi nhân viên link đợt (nghe + bình chọn): {publicVoteUrl}
                    </p>
                  ) : null}
                  <div className="space-y-2 rounded border border-slate-200 p-3">
                    <p className="text-sm font-medium">
                      Chọn ca khúc đưa vào đợt bình chọn
                    </p>
                    <div className="max-h-48 space-y-1 overflow-y-auto">
                      {tracks.length === 0 ? (
                        <p className="text-xs text-slate-500">
                          Chưa có ca khúc — thêm ở tab Ca khúc.
                        </p>
                      ) : (
                        tracks.map((t) => (
                          <label
                            key={t.id}
                            className="flex cursor-pointer items-start gap-2 text-sm"
                          >
                            <input
                              type="checkbox"
                              checked={campaignTrackIds.has(t.id)}
                              onChange={() => toggleCampaignTrack(t.id)}
                            />
                            <span>
                              {t.songCode} — {t.songTitle}
                              {!t.hasAudio ? (
                                <span className="text-xs text-amber-700">
                                  {' '}
                                  (chưa có file)
                                </span>
                              ) : null}
                            </span>
                          </label>
                        ))
                      )}
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      disabled={savingCampaignTracks || !selectedCampaignId}
                      onClick={() => void saveCampaignTracks()}
                    >
                      {savingCampaignTracks
                        ? 'Đang lưu…'
                        : 'Lưu danh sách bình chọn'}
                    </Button>
                    {selectedCampaignId ? (
                      <CampaignTracksExcelImport
                        campaignId={selectedCampaignId}
                        onImported={async () => {
                          await loadDetail(selectedCampaignId);
                          await load();
                        }}
                      />
                    ) : null}
                    {selectedCampaignId ? (
                      <CampaignVotersExcelImport
                        campaignId={selectedCampaignId}
                        voterCount={detail?.voterWhitelistCount}
                        onImported={async () => {
                          await loadDetail(selectedCampaignId);
                          await load();
                        }}
                      />
                    ) : null}
                  </div>
                  {selectedCampaignId && publicListenUrl ? (
                    <p className="break-all text-xs text-teal-800">
                      Link đợt (nghe + bình chọn): {publicListenUrl}
                    </p>
                  ) : null}
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Bài hát</TableHead>
                        <TableHead className="text-right">Phiếu</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(stats?.rows ?? []).map((r) => (
                        <TableRow key={r.trackId}>
                          <TableCell>
                            {r.songCode} — {r.songTitle}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {r.voteCount}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <p className="text-xs text-slate-500">
                    Tổng phiếu (VALID, server): {stats?.totalVotes ?? 0}
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
      <MusicTrackEditDialog
        track={editingTrack}
        open={editingTrack != null}
        onOpenChange={(open) => {
          if (!open) setEditingTrack(null);
        }}
        onSaved={async () => {
          if (selectedCampaignId) {
            await loadDetail(selectedCampaignId);
          }
          await load();
        }}
      />
    </MusicVotingAdminShell>
  );
}
