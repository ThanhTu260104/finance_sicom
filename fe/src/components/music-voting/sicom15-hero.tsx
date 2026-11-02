'use client';

import Image from 'next/image';
import {
  MUSIC_LISTEN_LOGO_PATH,
  musicListenPageCopy,
} from '@/lib/music-voting-public-brand';
import { sicom15PublicClasses } from '@/lib/sicom15-theme';

export function Sicom15Hero({
  isCampaignPage,
  campaignLine,
  campaignSubtitle,
  showVoteHint,
}: {
  isCampaignPage: boolean;
  /** Dòng phụ khi trang đợt (vd. tên đợt hoặc «Mỗi giai điệu…») */
  campaignLine?: string;
  campaignSubtitle?: string;
  showVoteHint?: boolean;
}) {
  const copy = musicListenPageCopy;

  const subtitle = isCampaignPage
    ? [campaignSubtitle?.trim() || copy.campaignVoteSubtitle, copy.tagline]
        .filter(Boolean)
        .join(' ')
    : `${copy.subtitle} ${copy.tagline}`;

  const secondaryLine =
    isCampaignPage &&
    (campaignLine?.trim() || copy.campaignVoteTitle);

  function scrollToTracks() {
    document.getElementById('sicom15-track-list')?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  }

  return (
    <header className="relative sicom15-enter mb-10 text-center md:mb-12">
      <div className="mb-4 flex justify-center sicom15-enter-delay-1">
        <div className="rounded-2xl border border-[#0c2340]/10 bg-white px-6 py-4 shadow-md md:px-8 md:py-5">
          <Image
            src={MUSIC_LISTEN_LOGO_PATH}
            alt="SICOM"
            width={280}
            height={84}
            className="h-14 w-auto object-contain sm:h-16 md:h-[4.5rem] lg:h-20"
            priority
          />
        </div>
      </div>

      <p className="sicom15-enter-delay-1 text-[10px] font-semibold uppercase tracking-[0.28em] text-[#8a6d2a] md:text-xs">
        {copy.eyebrow}
      </p>

      <div className="relative mx-auto mt-4 max-w-4xl sicom15-enter-delay-2">
        <div
          className="pointer-events-none absolute -left-2 top-1/2 -translate-y-1/2 select-none font-serif text-[5.5rem] font-bold leading-none text-[#c9a962]/25 md:-left-6 md:text-[8rem]"
          aria-hidden
        >
          15
        </div>
        <h1 className={`${sicom15PublicClasses.heroTitle} relative`}>
          <span className="block">{copy.titleLine1}</span>
          <span className="mt-1 block text-[#8a6d2a] md:mt-2">
            {copy.titleLine2}
          </span>
        </h1>
        {secondaryLine ? (
          <p className={`${sicom15PublicClasses.heroCampaignLine} relative mt-3`}>
            {secondaryLine}
          </p>
        ) : null}
      </div>

      <p className={sicom15PublicClasses.heroSubtitle}>{subtitle}</p>

      {showVoteHint ? (
        <p className="mx-auto mt-3 max-w-lg text-sm text-[#152d4a]/75 md:text-base">
          Nghe từng ca khúc bên dưới, bấm{' '}
          <span className="font-semibold text-[#8a6d2a]">Bình chọn</span> và xác
          nhận email công ty.
        </p>
      ) : null}

      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={scrollToTracks}
          className={`rounded-full px-6 py-2.5 text-sm md:text-base ${sicom15PublicClasses.btnGold}`}
        >
          {isCampaignPage ? 'Danh sách bình chọn' : 'Khám phá ca khúc'}
        </button>
      </div>
    </header>
  );
}
