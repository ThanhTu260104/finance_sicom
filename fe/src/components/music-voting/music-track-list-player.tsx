'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { Heart, Pause, Play } from 'lucide-react';
import type { MusicTrack } from '@/lib/api/music-voting';
import {
  publicTrackAudioUrl,
  trackUsesVideoPlayback,
} from '@/lib/api/music-voting';
import { sicom15PublicClasses } from '@/lib/sicom15-theme';
import { Sicom15TrackText } from '@/components/music-voting/sicom15-track-text';

type PlaybackCtx = {
  activeId: string | null;
  setActiveId: (id: string | null) => void;
};

const PlaybackContext = createContext<PlaybackCtx | null>(null);

export function MusicPlaybackProvider({ children }: { children: React.ReactNode }) {
  const [activeId, setActiveId] = useState<string | null>(null);
  return (
    <PlaybackContext.Provider value={{ activeId, setActiveId }}>
      {children}
    </PlaybackContext.Provider>
  );
}

function formatTime(sec: number) {
  if (!Number.isFinite(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function WaveformBars({ playing }: { playing: boolean }) {
  const seed = useId();
  const heights = [0.4, 0.7, 0.55, 0.9, 0.45, 0.75, 0.5, 0.85, 0.6, 0.7, 0.4, 0.8];
  return (
    <div
      className="flex h-8 items-end gap-[3px] opacity-80"
      aria-hidden={!playing}
    >
      {heights.map((h, i) => (
        <span
          key={`${seed}-${i}`}
          className={`w-[3px] rounded-full bg-[#c9a962] ${playing ? 'sicom15-wave-bar' : ''}`}
          style={{
            height: `${h * 100}%`,
            animationDelay: playing ? `${i * 0.06}s` : undefined,
          }}
        />
      ))}
    </div>
  );
}

export function MusicTrackListRow({
  track,
  index,
  votingOpen,
  voted,
  onVoteClick,
}: {
  track: MusicTrack;
  index: number;
  votingOpen: boolean;
  voted: boolean;
  onVoteClick: () => void;
}) {
  const ctx = useContext(PlaybackContext);
  const mediaRef = useRef<HTMLMediaElement | null>(null);
  const useVideo = trackUsesVideoPlayback(track);
  const playAttemptedRef = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);

  const isActive = ctx?.activeId === track.id;
  const canPlayAudio = track.hasAudio !== false;

  useEffect(() => {
    const el = mediaRef.current;
    if (!el) return;
    if (!isActive && playing) {
      el.pause();
      setPlaying(false);
    }
  }, [isActive, playing]);

  const togglePlay = useCallback(async () => {
    const el = mediaRef.current;
    if (!el || !canPlayAudio) return;
    setError(null);
    if (playing) {
      el.pause();
      setPlaying(false);
      return;
    }
    ctx?.setActiveId(track.id);
    setLoading(true);
    playAttemptedRef.current = true;
    try {
      el.load();
      await el.play();
      setPlaying(true);
    } catch {
      setError(
        'Không phát được file — kiểm tra ca khúc đã upload xong trên admin.',
      );
      setPlaying(false);
    } finally {
      setLoading(false);
    }
  }, [playing, ctx, track.id, canPlayAudio]);

  useEffect(() => {
    const el = mediaRef.current;
    if (!el) return;
    const onTime = () => setCurrent(el.currentTime);
    const onMeta = () => setDuration(el.duration || 0);
    const onEnd = () => {
      setPlaying(false);
      setCurrent(0);
    };
    const onWaiting = () => setLoading(true);
    const onCanPlay = () => setLoading(false);
    const onErr = () => {
      if (!playAttemptedRef.current) return;
      setError('Không tải được file nhạc — thử lại hoặc liên hệ Ban tổ chức.');
      setPlaying(false);
      setLoading(false);
    };
    el.addEventListener('timeupdate', onTime);
    el.addEventListener('loadedmetadata', onMeta);
    el.addEventListener('durationchange', onMeta);
    el.addEventListener('ended', onEnd);
    el.addEventListener('waiting', onWaiting);
    el.addEventListener('canplay', onCanPlay);
    el.addEventListener('error', onErr);
    return () => {
      el.removeEventListener('timeupdate', onTime);
      el.removeEventListener('loadedmetadata', onMeta);
      el.removeEventListener('durationchange', onMeta);
      el.removeEventListener('ended', onEnd);
      el.removeEventListener('waiting', onWaiting);
      el.removeEventListener('canplay', onCanPlay);
      el.removeEventListener('error', onErr);
    };
  }, [useVideo, track.id]);

  function seek(e: React.MouseEvent<HTMLDivElement>) {
    const el = mediaRef.current;
    if (!el || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    el.currentTime = ratio * duration;
    setCurrent(el.currentTime);
  }

  const progress = duration > 0 ? (current / duration) * 100 : 0;
  const order = String(index + 1).padStart(2, '0');

  return (
    <article
      className={`${sicom15PublicClasses.cardListen} sicom15-enter p-5 md:p-6 ${
        playing ? sicom15PublicClasses.cardListenActive : ''
      }`}
      style={{ animationDelay: `${Math.min(index * 0.05, 0.4)}s` }}
    >
      {useVideo ? (
        <video
          ref={mediaRef as React.RefObject<HTMLVideoElement>}
          playsInline
          preload="metadata"
          className="pointer-events-none absolute h-0 w-0 opacity-0"
          src={canPlayAudio ? publicTrackAudioUrl(track.id) : undefined}
        />
      ) : (
        <audio
          ref={mediaRef as React.RefObject<HTMLAudioElement>}
          preload="metadata"
          src={canPlayAudio ? publicTrackAudioUrl(track.id) : undefined}
        />
      )}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:gap-6">
        <div className="flex shrink-0 items-start gap-3 md:w-52 md:gap-4">
          <span
            className="font-serif text-5xl font-bold leading-none text-[#c9a962]/55 md:text-6xl"
            aria-hidden
          >
            {order}
          </span>
          <div className="min-w-0 flex-1 pt-1">
            <p className={sicom15PublicClasses.trackCode}>{track.songCode}</p>
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <Sicom15TrackText
            track={track}
            identityDisplay="pendingUntilVotingEnd"
          />

          {!canPlayAudio ? (
            <p className="mt-3 text-sm text-amber-800/90">
              File nhạc chưa sẵn sàng — Ban tổ chức sẽ cập nhật sau.
            </p>
          ) : (
            <>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void togglePlay()}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#0c2340]/15 bg-[#f8f6f0] text-[#0c2340] transition hover:border-[#c9a962] hover:bg-white"
              aria-label={playing ? 'Tạm dừng' : 'Phát'}
            >
              {loading && !playing ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#c9a962]/30 border-t-[#c9a962]" />
              ) : playing ? (
                <Pause className="h-5 w-5" fill="currentColor" />
              ) : (
                <Play className="ml-0.5 h-5 w-5" fill="currentColor" />
              )}
            </button>

            <div className="min-w-[120px] flex-1">
              <div
                role="slider"
                tabIndex={0}
                aria-valuemin={0}
                aria-valuemax={duration}
                aria-valuenow={current}
                className="group h-2 cursor-pointer rounded-full bg-[#0c2340]/10"
                onClick={seek}
                onKeyDown={(e) => {
                  const el = mediaRef.current;
                  if (!el) return;
                  if (e.key === 'ArrowRight') el.currentTime = Math.min(duration, current + 5);
                  if (e.key === 'ArrowLeft') el.currentTime = Math.max(0, current - 5);
                }}
              >
                <div
                  className="relative h-full rounded-full bg-[#c9a962]/25 transition-[width]"
                  style={{ width: `${progress}%` }}
                >
                  <span className="absolute right-0 top-1/2 h-3 w-3 -translate-y-1/2 translate-x-1/2 rounded-full bg-[#c9a962] opacity-0 group-hover:opacity-100" />
                </div>
              </div>
              <div className="mt-1 flex justify-between font-mono text-[10px] text-[#0c2340]/45">
                <span>{formatTime(current)}</span>
                <span>{duration > 0 ? formatTime(duration) : '--:--'}</span>
              </div>
            </div>

            <WaveformBars playing={playing} />
          </div>

          {error ? (
            <p className="mt-2 text-xs text-red-700" role="alert">
              {error}
            </p>
          ) : null}
          {playing ? (
            <p className="mt-2 text-[10px] uppercase tracking-wider text-[#8a6d2a]">
              Đang phát
            </p>
          ) : null}
            </>
          )}
        </div>

        {votingOpen ? (
          <div className="flex shrink-0 flex-col items-stretch justify-center md:w-44 lg:w-48">
            {voted ? (
              <span className="rounded-full border border-[#3d7ea6]/40 bg-[#3d7ea6]/10 px-4 py-3 text-center text-sm font-semibold text-[#0c2340]">
                ✓ Đã bình chọn
              </span>
            ) : (
              <button
                type="button"
                onClick={onVoteClick}
                className={sicom15PublicClasses.btnVote}
              >
                <span
                  className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 transition group-hover:opacity-100"
                  aria-hidden
                />
                <span className="relative flex items-center justify-center gap-2">
                  <Heart
                    className="h-4 w-4 fill-[#c9a962]/90 text-[#c9a962]"
                    aria-hidden
                  />
                  Bình chọn
                </span>
              </button>
            )}
          </div>
        ) : null}
      </div>
    </article>
  );
}
