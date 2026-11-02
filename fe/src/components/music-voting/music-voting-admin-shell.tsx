'use client';

import Image from 'next/image';
import { MUSIC_LISTEN_LOGO_PATH } from '@/lib/music-voting-public-brand';

export function MusicVotingAdminShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-full bg-[#f8f6f0]">
      <div className="border-b border-[#0c2340]/10 bg-[#0c2340] text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4 md:px-6">
          <div className="flex items-center gap-4">
            <div className="rounded-lg bg-white/95 px-3 py-2">
              <Image
                src={MUSIC_LISTEN_LOGO_PATH}
                alt="SICOM"
                width={200}
                height={60}
                className="h-10 w-auto object-contain md:h-11"
              />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#c9a962]">
                SICOM 15 YEARS · Quản trị
              </p>
              <h1 className="font-serif text-base font-semibold md:text-lg">
                Chương trình âm nhạc kỷ niệm 15 năm
              </h1>
            </div>
          </div>
          <p className="max-w-xs text-right text-xs text-[#ebe8e0]/70">
            Upload ca khúc · đợt bình chọn · whitelist · thống kê
          </p>
        </div>
      </div>
      <div className="mx-auto max-w-6xl">{children}</div>
    </div>
  );
}
