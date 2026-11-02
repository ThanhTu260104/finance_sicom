'use client';

import { useEffect, useId, useState } from 'react';
import { Mail, ShieldCheck, User } from 'lucide-react';
import { toast } from 'sonner';
import { musicVotingApi } from '@/lib/api';
import type { MusicTrack } from '@/lib/api/music-voting';
import { musicListenPageCopy } from '@/lib/music-voting-public-brand';
import { sicom15PublicClasses } from '@/lib/sicom15-theme';
import { Sicom15TrackText } from '@/components/music-voting/sicom15-track-text';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

const VOTER_KEY_STORAGE = 'music-voting-voter-key';

const voteDialogInputClass =
  'flex h-11 w-full rounded-lg border border-[#0c2340]/12 bg-white pl-10 pr-3 text-sm text-[#0c2340] shadow-sm transition placeholder:text-[#0c2340]/35 focus-visible:border-[#c9a962]/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c9a962]/25 md:text-base';

function getOrCreateVoterKey() {
  if (typeof window === 'undefined') return '';
  let key = localStorage.getItem(VOTER_KEY_STORAGE);
  if (!key) {
    key =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `v-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(VOTER_KEY_STORAGE, key);
  }
  return key;
}

function voterProfileKey(campaignId: string) {
  return `music-voting-profile:${campaignId}`;
}

function VerifyField({
  id,
  label,
  icon: Icon,
  ...props
}: {
  id: string;
  label: string;
  icon: typeof Mail;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={id}
        className="block text-xs font-semibold uppercase tracking-wider text-[#8a6d2a]"
      >
        {label}
      </label>
      <div className="relative">
        <Icon
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0c2340]/35"
          aria-hidden
        />
        <input id={id} className={voteDialogInputClass} {...props} />
      </div>
    </div>
  );
}

export function MusicTrackVoteDialog({
  open,
  onOpenChange,
  campaignId,
  track,
  maxTracksPerBallot,
  whitelistRequired,
  onVoted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: string;
  track: MusicTrack | null;
  maxTracksPerBallot: number;
  whitelistRequired: boolean;
  onVoted: (trackId: string) => void;
}) {
  const emailId = useId();
  const nameId = useId();
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<'form' | 'success'>('form');
  const [fieldError, setFieldError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setStep('form');
      setFieldError(null);
      return;
    }
    if (!campaignId || typeof window === 'undefined') return;
    try {
      const raw = sessionStorage.getItem(voterProfileKey(campaignId));
      if (raw) {
        const p = JSON.parse(raw) as { email?: string; fullName?: string };
        if (p.email) setEmail(p.email);
        if (p.fullName) setFullName(p.fullName);
      }
    } catch {
      /* ignore */
    }
  }, [open, campaignId]);

  async function submit() {
    if (!track || !campaignId) return;
    setFieldError(null);
    if (whitelistRequired) {
      if (!email.trim() || !fullName.trim()) {
        setFieldError('Vui lòng nhập đầy đủ email và họ tên.');
        return;
      }
    }

    setSubmitting(true);
    try {
      if (whitelistRequired) {
        const verify = await musicVotingApi.publicVerifyVoter(
          campaignId,
          email.trim(),
          fullName.trim(),
          track.id,
        );
        if (!verify.ok) {
          setFieldError('Email hoặc họ tên không khớp danh sách được bình chọn.');
          return;
        }
        if ('trackAlreadyVoted' in verify && verify.trackAlreadyVoted) {
          toast.message('Bạn đã bình chọn ca khúc này');
          onVoted(track.id);
          onOpenChange(false);
          return;
        }
        if (
          'votesRemaining' in verify &&
          verify.votesRemaining != null &&
          verify.votesRemaining <= 0
        ) {
          setFieldError('Bạn đã hết lượt bình chọn trong đợt này.');
          return;
        }
      }

      await musicVotingApi.publicSubmitVote(
        campaignId,
        [track.id],
        getOrCreateVoterKey(),
        whitelistRequired ? email.trim() : undefined,
        whitelistRequired ? fullName.trim() : undefined,
      );

      if (whitelistRequired) {
        sessionStorage.setItem(
          voterProfileKey(campaignId),
          JSON.stringify({ email: email.trim(), fullName: fullName.trim() }),
        );
      }

      onVoted(track.id);
      setStep('success');
    } catch (e) {
      setFieldError(e instanceof Error ? e.message : 'Không gửi được bình chọn');
    } finally {
      setSubmitting(false);
    }
  }

  const dialogShell =
    'gap-0 overflow-hidden border-[#c9a962]/30 bg-[#f3f0e8] p-0 text-[#0c2340] shadow-2xl shadow-[#0c2340]/15 sm:max-w-md [&>button]:right-4 [&>button]:top-4 [&>button]:rounded-full [&>button]:border [&>button]:border-[#0c2340]/10 [&>button]:bg-white/90 [&>button]:text-[#0c2340]/70 [&>button]:hover:bg-white [&>button]:hover:text-[#0c2340]';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn('max-w-md', dialogShell)}>
        <div
          className="h-1 shrink-0 bg-gradient-to-r from-[#c9a962] via-[#e8d5a3] to-[#c9a962]"
          aria-hidden
        />

        {step === 'success' ? (
          <>
            <DialogHeader className="border-0 bg-transparent px-5 pb-0 pt-5 pr-14 text-left">
              <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#8a6d2a]">
                {musicListenPageCopy.eyebrow}
              </p>
              <DialogTitle
                className={`${sicom15PublicClasses.heroCampaignLine} mt-2 text-left`}
              >
                Phiếu bình chọn đã ghi nhận
              </DialogTitle>
              <DialogDescription
                className={`${sicom15PublicClasses.heroSubtitle} mx-0 mt-2 max-w-none text-left text-[#152d4a]/80`}
              >
                {musicListenPageCopy.voteSuccessMessage}
              </DialogDescription>
            </DialogHeader>
            <DialogBody className="px-5 py-4">
              {track ? (
                <div
                  className={`${sicom15PublicClasses.cardListen} px-4 py-4`}
                >
                  <Sicom15TrackText
                    track={track}
                    titleAs="h3"
                    identityDisplay="pendingUntilVotingEnd"
                  />
                </div>
              ) : null}
            </DialogBody>
            <DialogFooter className="border-t border-[#0c2340]/8 bg-white/80 px-5 py-4 sm:flex-col">
              <button
                type="button"
                className={`w-full rounded-full py-2.5 text-sm md:text-base ${sicom15PublicClasses.btnGold}`}
                onClick={() => onOpenChange(false)}
              >
                Đóng
              </button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader className="border-0 bg-transparent px-5 pb-0 pt-5 pr-14 text-left">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#c9a962]/35 bg-white/80 px-3 py-1 text-xs font-medium text-[#8a6d2a]">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
                Xác minh nhân viên
              </div>
              <DialogTitle
                className={`${sicom15PublicClasses.heroCampaignLine} text-left text-[#0c2340]`}
              >
                {whitelistRequired
                  ? 'Xác nhận trước khi bình chọn'
                  : 'Xác nhận lựa chọn'}
              </DialogTitle>
              <DialogDescription className="mt-2 max-w-none text-left text-sm leading-relaxed text-[#152d4a]/75 md:text-base">
                {whitelistRequired
                  ? 'Thông tin dùng một lần để đối chiếu danh sách Ban tổ chức. Mỗi nhân viên chỉ bình chọn theo số lượt quy định.'
                  : 'Bạn có chắc muốn bình chọn ca khúc này?'}
              </DialogDescription>
            </DialogHeader>

            <DialogBody className="space-y-4 px-5 py-4">
              {track ? (
                <div
                  className={`${sicom15PublicClasses.cardListen} border-[#c9a962]/25 bg-white px-4 py-3.5`}
                >
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#8a6d2a]">
                    Ca khúc bạn chọn
                  </p>
                  <div className="mt-2">
                    <Sicom15TrackText
                      track={track}
                      titleAs="h3"
                      identityDisplay="pendingUntilVotingEnd"
                    />
                  </div>
                  {maxTracksPerBallot > 0 ? (
                    <p className="mt-3 border-t border-[#0c2340]/8 pt-3 text-xs text-[#0c2340]/55 md:text-sm">
                      Tối đa{' '}
                      <span className="font-semibold text-[#8a6d2a]">
                        {maxTracksPerBallot}
                      </span>{' '}
                      ca khúc / nhân viên trong đợt.
                    </p>
                  ) : null}
                </div>
              ) : null}

              {whitelistRequired ? (
                <div className="rounded-xl border border-[#0c2340]/10 bg-white p-4 shadow-sm">
                  <VerifyField
                    id={emailId}
                    label="Email công ty"
                    icon={Mail}
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    placeholder="ten.ban@congty.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={submitting}
                  />
                  <div className="mt-3">
                    <VerifyField
                      id={nameId}
                      label="Họ và tên"
                      icon={User}
                      autoComplete="name"
                      placeholder="Nguyễn Văn A"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      disabled={submitting}
                    />
                  </div>
                  <p className="mt-3 text-xs leading-relaxed text-[#0c2340]/50">
                    Nhập đúng như email và họ tên trong danh sách Ban tổ chức
                    đã gửi (phân biệt dấu tiếng Việt).
                  </p>
                </div>
              ) : null}

              {fieldError ? (
                <div
                  className="rounded-lg border border-red-200/80 bg-red-50/90 px-3 py-2.5 text-sm text-red-800"
                  role="alert"
                >
                  {fieldError}
                </div>
              ) : null}
            </DialogBody>

            <DialogFooter className="flex-col gap-2.5 border-t border-[#0c2340]/8 bg-white/85 px-5 py-4 sm:flex-col">
              <button
                type="button"
                disabled={submitting}
                onClick={() => void submit()}
                className={`w-full disabled:opacity-60 ${sicom15PublicClasses.btnVote}`}
              >
                {submitting
                  ? 'Đang xác nhận…'
                  : whitelistRequired
                    ? 'Xác minh & bình chọn'
                    : 'Xác nhận bình chọn'}
              </button>
              <button
                type="button"
                className={`w-full rounded-full py-2.5 text-sm ${sicom15PublicClasses.btnVoteOutline}`}
                onClick={() => onOpenChange(false)}
                disabled={submitting}
              >
                Quay lại
              </button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
