'use client';

import './sicom15-public.css';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { toast, Toaster } from 'sonner';
import { musicVotingApi } from '@/lib/api/music-voting';
import type { MusicTrack, PublicVotingCampaign } from '@/lib/api/music-voting';
import { MusicTrackVoteDialog } from '@/components/music-voting/music-track-vote-dialog';
import {
  MusicPlaybackProvider,
  MusicTrackListRow,
} from '@/components/music-voting/music-track-list-player';
import { Sicom15Hero } from '@/components/music-voting/sicom15-hero';
import { Sicom15SceneBackground } from '@/components/music-voting/sicom15-scene-background';
import { musicListenPageCopy } from '@/lib/music-voting-public-brand';
import { sicom15PublicClasses } from '@/lib/sicom15-theme';

function PublicListenMusicContent() {
  const searchParams = useSearchParams();
  const campaignId = searchParams.get('campaignId')?.trim() || undefined;
  const isCampaignPage = Boolean(campaignId);
  const [ballot, setBallot] = useState<PublicVotingCampaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [voteTrack, setVoteTrack] = useState<MusicTrack | null>(null);
  const [voteDialogOpen, setVoteDialogOpen] = useState(false);
  const [votedTrackIds, setVotedTrackIds] = useState<Set<string>>(new Set());
  const copy = useMemo(() => musicListenPageCopy, []);

  const tracks = useMemo(
    () => ballot?.tracks?.map((x) => x.track) ?? [],
    [ballot],
  );

  const votingOpen = Boolean(
    isCampaignPage &&
      ballot?.votingOpen &&
      ballot.id &&
      !ballot.catalogMode,
  );
  const whitelistRequired =
    isCampaignPage && ballot?.voterWhitelistRequired === true;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const row = await musicVotingApi.publicGetBallot(campaignId);
      setBallot(row);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Không tải được danh sách nhạc');
      setBallot(null);
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!ballot?.id || !isCampaignPage || typeof window === 'undefined') return;
    try {
      const raw = sessionStorage.getItem(`music-voted-tracks:${ballot.id}`);
      if (raw) {
        const ids = JSON.parse(raw) as string[];
        setVotedTrackIds(new Set(ids));
      } else {
        setVotedTrackIds(new Set());
      }
    } catch {
      setVotedTrackIds(new Set());
    }
  }, [ballot?.id, isCampaignPage]);

  function markVoted(trackId: string) {
    setVotedTrackIds((prev) => {
      const next = new Set(prev);
      next.add(trackId);
      if (ballot?.id) {
        sessionStorage.setItem(
          `music-voted-tracks:${ballot.id}`,
          JSON.stringify([...next]),
        );
      }
      return next;
    });
  }

  function openVoteFor(track: MusicTrack) {
    setVoteTrack(track);
    setVoteDialogOpen(true);
  }

  return (
    <>
      <Toaster richColors position="top-center" />
      <div className={sicom15PublicClasses.page}>
        <Sicom15SceneBackground />

        <div className="relative z-10 mx-auto max-w-4xl px-4 pb-20 pt-6 md:px-6 md:pt-10">
          <Sicom15Hero
            isCampaignPage={isCampaignPage}
            campaignLine={
              isCampaignPage
                ? ballot?.name?.trim() || copy.campaignVoteTitle
                : undefined
            }
            campaignSubtitle={
              isCampaignPage
                ? ballot?.description?.trim() || copy.campaignVoteSubtitle
                : undefined
            }
            showVoteHint={votingOpen && whitelistRequired}
          />

          <section id="sicom15-track-list" className="scroll-mt-8">
            <div className="mb-6 flex items-end justify-between gap-4 border-b border-[#0c2340]/10 pb-3">
              <h2 className={sicom15PublicClasses.sectionTitle}>
                {isCampaignPage ? 'Ca khúc trong đợt' : 'Tuyển tập ca khúc'}
              </h2>
              <span className="text-xs uppercase tracking-wider text-[#0c2340]/45 md:text-sm">
                {isCampaignPage ? 'Nghe & bình chọn' : 'Chỉ nghe'}
              </span>
            </div>

            {loading ? (
              <p className="py-12 text-center text-sm text-[#0c2340]/60">
                Đang tải thư viện nhạc…
              </p>
            ) : isCampaignPage && ballot?.needsTrackAssignment ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-8 text-center">
                <p className="text-sm text-amber-950/85">
                  Đợt «{ballot.name}» chưa gán ca khúc. Ban tổ chức cần cấu hình
                  danh sách bài trong admin.
                </p>
              </div>
            ) : tracks.length === 0 ? (
              <div className="rounded-xl border border-[#0c2340]/10 bg-white p-8 text-center shadow-sm">
                <p className="text-sm text-[#0c2340]/70">
                  Chưa có ca khúc trong danh sách này.
                </p>
              </div>
            ) : (
              <MusicPlaybackProvider>
                <ul className="flex flex-col gap-4">
                  {tracks.map((t, i) => (
                    <li key={t.id}>
                      <MusicTrackListRow
                        track={t}
                        index={i}
                        votingOpen={votingOpen}
                        voted={votedTrackIds.has(t.id)}
                        onVoteClick={() => openVoteFor(t)}
                      />
                    </li>
                  ))}
                </ul>
              </MusicPlaybackProvider>
            )}
          </section>

          <p className="mt-12 text-center text-xs leading-relaxed text-[#0c2340]/45 md:text-sm">
            {copy.footerNote}
          </p>
        </div>
      </div>

      {isCampaignPage && ballot?.id ? (
        <MusicTrackVoteDialog
          open={voteDialogOpen}
          onOpenChange={setVoteDialogOpen}
          campaignId={campaignId ?? ballot.id}
          track={voteTrack}
          maxTracksPerBallot={ballot.maxTracksPerBallot ?? 0}
          whitelistRequired={whitelistRequired}
          onVoted={markVoted}
        />
      ) : null}
    </>
  );
}

export default function PublicListenMusicPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#f3f0e8] text-[#0c2340]/70">
          Đang tải…
        </div>
      }
    >
      <PublicListenMusicContent />
    </Suspense>
  );
}
