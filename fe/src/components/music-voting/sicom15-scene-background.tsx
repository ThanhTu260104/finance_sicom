'use client';

import { MUSIC_LISTEN_BACKGROUND_PATH } from '@/lib/music-voting-public-brand';

export function Sicom15SceneBackground() {
  const bgUrl = encodeURI(MUSIC_LISTEN_BACKGROUND_PATH);

  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-[0.14]"
        style={{ backgroundImage: `url("${bgUrl}")` }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-[#faf8f4] via-[#f3f0e8] to-[#ebe6dc]" />
      <svg
        className="absolute inset-0 h-full w-full opacity-[0.08]"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <pattern
            id="sicom15-grid"
            width="48"
            height="48"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 48 0 L 0 0 0 48"
              fill="none"
              stroke="#0c2340"
              strokeWidth="0.5"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#sicom15-grid)" />
      </svg>
      <div className="sicom15-hero-glow absolute -left-1/4 top-0 h-[380px] w-[65%] rounded-full bg-[#3d7ea6]/8 blur-[100px]" />
      <div className="absolute -right-1/4 top-1/4 h-[320px] w-[50%] rounded-full bg-[#c9a962]/12 blur-[90px]" />
    </div>
  );
}
