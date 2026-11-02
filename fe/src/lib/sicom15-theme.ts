/** Token màu & copy — kỷ niệm 15 năm SICOM (module âm nhạc). */
export const sicom15Colors = {
  navy: '#0c2340',
  navyDeep: '#061528',
  navySoft: '#152d4a',
  champagne: '#c9a962',
  champagneLight: '#e8d5a3',
  ivory: '#f8f6f0',
  ivoryMuted: '#ebe8e0',
  accent: '#3d7ea6',
} as const;

export const sicom15PublicClasses = {
  page: 'sicom15-page min-h-screen bg-[#f3f0e8] text-[#0c2340] font-sans antialiased',
  heroTitle:
    'font-serif font-bold tracking-tight text-balance text-[#0c2340] text-xl leading-snug md:text-2xl lg:text-[1.75rem]',
  heroCampaignLine:
    'font-serif text-lg font-semibold text-[#8a6d2a] md:text-xl lg:text-2xl',
  heroSubtitle:
    'mx-auto mt-4 max-w-2xl text-pretty text-sm leading-relaxed text-[#152d4a]/85 md:text-base lg:text-lg',
  sectionTitle: 'font-serif text-xl text-[#0c2340] md:text-2xl',
  trackTitle:
    'font-serif text-xl font-semibold leading-snug text-[#0c2340] md:text-2xl lg:text-[1.65rem]',
  trackPerformer: 'mt-2 text-base text-[#152d4a]/85 md:text-lg',
  trackAuthor: 'mt-0.5 text-sm text-[#0c2340]/60 md:text-base',
  trackCode:
    'font-mono text-xs font-medium uppercase tracking-wider text-[#8a6d2a] md:text-sm',
  trackContestant: 'mt-1 text-xs uppercase text-[#0c2340]/50 md:text-sm',
  goldText: 'text-[#8a6d2a]',
  goldBorder: 'border-[#c9a962]/45',
  cardListen:
    'rounded-xl border border-[#0c2340]/10 bg-white/90 shadow-sm shadow-[#0c2340]/5 transition-[border-color,box-shadow] duration-300',
  cardListenActive:
    'border-[#c9a962]/60 bg-white shadow-md shadow-[#c9a962]/15 ring-1 ring-[#c9a962]/25',
  btnGold:
    'bg-gradient-to-b from-[#e8d5a3] to-[#c9a962] text-[#0c2340] font-semibold tracking-wide hover:from-[#f5ecd4] hover:to-[#d4b872] border border-[#c9a962]/60 shadow-sm',
  /** Nút bình chọn ca khúc — nổi bật trên thẻ bài hát */
  btnVote:
    'group relative overflow-hidden rounded-full bg-gradient-to-br from-[#0c2340] via-[#152d4a] to-[#0c2340] px-5 py-3 text-sm font-semibold tracking-wide text-[#f5ecd4] shadow-md shadow-[#0c2340]/25 ring-2 ring-[#c9a962]/50 transition hover:scale-[1.02] hover:shadow-lg hover:ring-[#c9a962]/80 active:scale-[0.98] md:px-6 md:py-3.5 md:text-base',
  btnVoteOutline:
    'border border-[#0c2340]/20 bg-white text-[#0c2340] hover:bg-[#f8f6f0]',
} as const;
