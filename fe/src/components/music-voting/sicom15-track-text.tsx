'use client';

import type { MusicTrack } from '@/lib/api/music-voting';
import { musicListenPageCopy } from '@/lib/music-voting-public-brand';
import { sicom15PublicClasses } from '@/lib/sicom15-theme';

/** Typography ca khúc — dùng chung list nghe & popup bình chọn. */
export function Sicom15TrackText({
  track,
  showCodes = false,
  titleAs = 'h2',
  identityDisplay = 'database',
}: {
  track: MusicTrack;
  showCodes?: boolean;
  titleAs?: 'h2' | 'h3' | 'p';
  /** Trang nghe công khai: ẩn người trình bày; tác giả hiện câu chờ công bố. */
  identityDisplay?: 'database' | 'pendingUntilVotingEnd';
}) {
  const pending = musicListenPageCopy.identityPendingUntilVotingEnd;
  const TitleTag = titleAs;
  return (
    <div>
      {showCodes ? (
        <div className="mb-2">
          <p className={sicom15PublicClasses.trackCode}>{track.songCode}</p>
          {track.contestantCode ? (
            <p className={sicom15PublicClasses.trackContestant}>
              {track.contestantCode}
            </p>
          ) : null}
        </div>
      ) : null}
      <TitleTag className={sicom15PublicClasses.trackTitle}>{track.songTitle}</TitleTag>
      {identityDisplay === 'pendingUntilVotingEnd' ? (
        <p className={`${sicom15PublicClasses.trackAuthor} mt-2`}>
          Tác giả: {pending}
        </p>
      ) : (
        <>
          <p className={sicom15PublicClasses.trackPerformer}>{track.performerName}</p>
          {track.authorName ? (
            <p className={sicom15PublicClasses.trackAuthor}>
              Tác giả: {track.authorName}
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
