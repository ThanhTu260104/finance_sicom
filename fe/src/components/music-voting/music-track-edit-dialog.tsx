'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { musicVotingApi } from '@/lib/api';
import type { MusicTrack, MusicTrackPublicStatus } from '@/lib/api/music-voting';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

type FormState = {
  songCode: string;
  contestantCode: string;
  performerName: string;
  authorName: string;
  songTitle: string;
  publicStatus: MusicTrackPublicStatus;
};

function trackToForm(track: MusicTrack): FormState {
  return {
    songCode: track.songCode,
    contestantCode: track.contestantCode,
    performerName: track.performerName,
    authorName: track.authorName,
    songTitle: track.songTitle,
    publicStatus: track.publicStatus,
  };
}

export function MusicTrackEditDialog({
  track,
  open,
  onOpenChange,
  onSaved,
}: {
  track: MusicTrack | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void | Promise<void>;
}) {
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (track && open) {
      setForm(trackToForm(track));
    }
  }, [track, open]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!track || !form) return;
    setSaving(true);
    try {
      await musicVotingApi.updateTrack(track.id, {
        songCode: form.songCode.trim(),
        contestantCode: form.contestantCode.trim(),
        performerName: form.performerName.trim(),
        authorName: form.authorName.trim(),
        songTitle: form.songTitle.trim(),
        publicStatus: form.publicStatus,
      });
      toast.success('Đã cập nhật thông tin ca khúc');
      onOpenChange(false);
      await onSaved();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Không lưu được thông tin ca khúc',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <form onSubmit={(e) => void submit(e)}>
          <DialogHeader>
            <DialogTitle>Sửa thông tin ca khúc</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-2">
            {form ? (
              <>
                <Input
                  placeholder="Mã bài hát"
                  value={form.songCode}
                  onChange={(e) =>
                    setForm((f) => f && { ...f, songCode: e.target.value })
                  }
                  required
                />
                <Input
                  placeholder="Mã thí sinh"
                  value={form.contestantCode}
                  onChange={(e) =>
                    setForm((f) => f && { ...f, contestantCode: e.target.value })
                  }
                  required
                />
                <Input
                  placeholder="Tên bài hát"
                  value={form.songTitle}
                  onChange={(e) =>
                    setForm((f) => f && { ...f, songTitle: e.target.value })
                  }
                  required
                />
                <Input
                  placeholder="Ca sĩ / trình bày"
                  value={form.performerName}
                  onChange={(e) =>
                    setForm((f) => f && { ...f, performerName: e.target.value })
                  }
                  required
                />
                <Input
                  placeholder="Tác giả"
                  value={form.authorName}
                  onChange={(e) =>
                    setForm((f) => f && { ...f, authorName: e.target.value })
                  }
                  required
                />
                <Select
                  value={form.publicStatus}
                  onChange={(e) =>
                    setForm((f) =>
                      f
                        ? {
                            ...f,
                            publicStatus: e.target
                              .value as MusicTrackPublicStatus,
                          }
                        : f,
                    )
                  }
                >
                  <option value="PUBLIC">Công khai (nghe nhạc)</option>
                  <option value="DRAFT">Nháp</option>
                  <option value="HIDDEN">Ẩn</option>
                </Select>
              </>
            ) : null}
          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Hủy
            </Button>
            <Button type="submit" size="sm" disabled={saving || !form}>
              {saving ? 'Đang lưu…' : 'Lưu'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
