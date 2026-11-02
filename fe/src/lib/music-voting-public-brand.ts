/** Nền full-screen trang nghe nhạc (file trong `public/`). */
export const MUSIC_LISTEN_BACKGROUND_PATH =
  '/Background 1920×1080@2x.png';

/** Cùng logo với app chính (`public/logo.jpg`). */
export const MUSIC_LISTEN_LOGO_PATH = '/logo.jpg';

function envOr(key: string, fallback: string) {
  const v = process.env[key]?.trim();
  return v || fallback;
}

export const musicListenPageCopy = {
  eyebrow: envOr(
    'NEXT_PUBLIC_MUSIC_COMPETITION_EYEBROW',
    'Kỷ niệm 15 năm · SICOM 15 YEARS',
  ),
  titleLine1: envOr(
    'NEXT_PUBLIC_MUSIC_COMPETITION_TITLE_LINE1',
    'SICOM — 15 NĂM MỘT HÀNH TRÌNH',
  ),
  titleLine2: envOr(
    'NEXT_PUBLIC_MUSIC_COMPETITION_TITLE_LINE2',
    'VỮNG BƯỚC TƯƠNG LAI',
  ),
  subtitle: envOr(
    'NEXT_PUBLIC_MUSIC_COMPETITION_SUBTITLE',
    'Mười lăm năm — một hành trình được viết nên từ niềm tin, sự tận tâm và những con người cùng chung khát vọng.',
  ),
  tagline: envOr(
    'NEXT_PUBLIC_MUSIC_COMPETITION_TAGLINE',
    'Lắng nghe những giai điệu. Cảm nhận một hành trình. Cùng viết tiếp tương lai.',
  ),
  campaignVoteTitle: envOr(
    'NEXT_PUBLIC_MUSIC_CAMPAIGN_VOTE_TITLE',
    'MỖI GIAI ĐIỆU — MỘT DẤU ẤN SICOM',
  ),
  campaignVoteSubtitle: envOr(
    'NEXT_PUBLIC_MUSIC_CAMPAIGN_VOTE_SUBTITLE',
    'Mỗi ca khúc là một sắc màu của hành trình. Hãy lắng nghe, cảm nhận và chọn giai điệu bạn muốn đồng hành cùng SICOM trên chặng đường tiếp theo.',
  ),
  footerNote: envOr(
    'NEXT_PUBLIC_MUSIC_COMPETITION_FOOTER',
    'Chương trình âm nhạc nội bộ — Công ty Cổ phần Đầu tư Xây dựng SICOM.',
  ),
  voteSuccessMessage: envOr(
    'NEXT_PUBLIC_MUSIC_VOTE_SUCCESS',
    'Cảm ơn bạn đã góp một giai điệu vào hành trình 15 năm SICOM.',
  ),
  /** Trang nghe công khai — thay tên tác giả / người trình bày thật. */
  identityPendingUntilVotingEnd: envOr(
    'NEXT_PUBLIC_MUSIC_IDENTITY_PENDING',
    'Được công bố sau khi kết thúc bình chọn',
  ),
};
