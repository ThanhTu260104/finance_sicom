import { getStoredAuthToken } from '@/lib/auth-storage';
import { putProjectReportStagedFile } from './project-report-staged-upload';
import { API_URL, ApiError, apiFetch } from './client';

export const MUSIC_TRACK_MAX_BYTES = 100 * 1024 * 1024;

/** Input file — khớp whitelist BE (kể cả .mov / QuickTime). */
export const MUSIC_TRACK_FILE_ACCEPT =
  'audio/*,video/mp4,video/quicktime,.mp3,.wav,.m4a,.aac,.ogg,.webm,.mp4,.mov';

type UploadProgressOptions = {
  onProgress?: (percent: number) => void;
  timeoutMs?: number;
};

function postMultipart<T>(
  path: string,
  form: FormData,
  options?: UploadProgressOptions,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_URL}${path}`);
    const token = getStoredAuthToken();
    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    }
    xhr.timeout = options?.timeoutMs ?? 600_000;
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && options?.onProgress) {
        options.onProgress(
          Math.min(100, Math.round((100 * event.loaded) / event.total)),
        );
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText) as T);
        } catch {
          reject(new ApiError('Phản hồi server không hợp lệ', xhr.status));
        }
        return;
      }
      let message = xhr.statusText || 'Upload thất bại';
      try {
        const body = JSON.parse(xhr.responseText) as {
          message?: string | string[];
        };
        const raw = body?.message;
        if (Array.isArray(raw)) message = raw.join(' · ');
        else if (typeof raw === 'string' && raw.trim()) message = raw;
      } catch {
        /* ignore */
      }
      reject(new ApiError(message, xhr.status));
    };
    xhr.onerror = () =>
      reject(
        new ApiError(
          `Không kết nối được API (${API_URL}). Kiểm tra backend.`,
          0,
        ),
      );
    xhr.onabort = () =>
      reject(new ApiError('Upload bị hủy hoặc hết thời gian chờ', 0));
    xhr.send(form);
  });
}

export function publicTrackAudioUrl(trackId: string) {
  return `${API_URL}/public/voting/tracks/${trackId}/audio`;
}

export function adminTrackAudioUrl(trackId: string) {
  return `${API_URL}/music-tracks/${trackId}/audio`;
}

export type MusicTrackConversionStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'READY'
  | 'FAILED';
export type MusicTrackPublicStatus = 'DRAFT' | 'PUBLIC' | 'HIDDEN';
export type VotingCampaignStatus =
  | 'DRAFT'
  | 'SCHEDULED'
  | 'ACTIVE'
  | 'CLOSED'
  | 'ARCHIVED';

export interface MusicTrack {
  id: string;
  songCode: string;
  contestantCode: string;
  performerName: string;
  authorName: string;
  songTitle: string;
  originalFilePath?: string | null;
  mp3FilePath?: string | null;
  mimeType?: string | null;
  fileSizeBytes?: string | null;
  conversionStatus: MusicTrackConversionStatus;
  publicStatus: MusicTrackPublicStatus;
  displayOrder: number;
  hasAudio?: boolean;
  createdAt: string;
  updatedAt: string;
}

/** .mov / video — mobile Safari cần thẻ `<video playsInline>`, không phát được qua `<audio>`. */
export function trackUsesVideoPlayback(
  track: Pick<MusicTrack, 'mimeType' | 'originalFilePath' | 'mp3FilePath'>,
): boolean {
  const mime = track.mimeType?.trim().toLowerCase() ?? '';
  if (
    mime === 'video/quicktime' ||
    mime === 'video/x-quicktime' ||
    mime.startsWith('video/')
  ) {
    return true;
  }
  const pathHint = `${track.originalFilePath ?? ''} ${track.mp3FilePath ?? ''}`.toLowerCase();
  if (pathHint.includes('.mov')) return true;
  if (mime === 'video/mp4' || pathHint.includes('.mp4')) {
    return mime.startsWith('video/');
  }
  return false;
}

export interface VotingCampaign {
  id: string;
  name: string;
  description?: string | null;
  startAt: string;
  endAt: string;
  status: VotingCampaignStatus;
  maxTracksPerBallot: number;
  resultPublishConfig?: Record<string, unknown> | null;
  trackCount?: number;
  voteCount?: number;
  voterWhitelistCount?: number;
}

export interface VotingCampaignDetail extends VotingCampaign {
  tracks: Array<{
    id: string;
    displayOrder: number;
    track: MusicTrack;
  }>;
}

export interface VotingStatsRow {
  trackId: string;
  songCode: string;
  songTitle: string;
  performerName: string;
  voteCount: number;
}

export interface VotingCampaignStats {
  campaignId: string;
  totalVotes: number;
  computedAt: string;
  rows: VotingStatsRow[];
}

export interface PublicVotingCampaign extends VotingCampaignDetail {
  votingOpen: boolean;
  statsVisible: boolean;
  /** Chưa có đợt hoặc đợt chưa gán bài — đang liệt kê toàn thư viện. */
  catalogMode?: boolean;
  showAllTracks?: boolean;
  needsTrackAssignment?: boolean;
  /** Có import whitelist → bắt buộc mã NV khi bình chọn. */
  voterWhitelistRequired?: boolean;
}

export type MusicTrackUploadInit = {
  trackId: string;
  uploadTarget: 'r2' | 'local';
  uploadUrl: string;
  method: 'PUT' | 'POST';
  headers: Record<string, string>;
};

async function finishTrackUpload(
  init: MusicTrackUploadInit,
  file: File,
  options?: UploadProgressOptions,
): Promise<MusicTrack> {
  const onProgress = options?.onProgress ?? (() => {});
  if (init.uploadTarget === 'r2' && init.method === 'PUT') {
    await putProjectReportStagedFile(
      init.uploadUrl,
      file,
      init.headers,
      onProgress,
    );
    return apiFetch<MusicTrack>(`/music-tracks/${init.trackId}/r2/complete`, {
      method: 'POST',
    });
  }
  const form = new FormData();
  form.append('file', file);
  return postMultipart<MusicTrack>(
    `/music-tracks/${init.trackId}/audio`,
    form,
    options,
  );
}

export const musicVotingApi = {
  listTracks: (search?: string) =>
    apiFetch<MusicTrack[]>(
      `/music-tracks${search?.trim() ? `?search=${encodeURIComponent(search.trim())}` : ''}`,
    ),

  createTrack: (body: Partial<MusicTrack> & Pick<MusicTrack, 'songCode' | 'contestantCode' | 'performerName' | 'authorName' | 'songTitle'>) =>
    apiFetch<MusicTrack>('/music-tracks', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  createTrackWithAudio: async (
    file: File,
    body: Pick<
      MusicTrack,
      'songCode' | 'contestantCode' | 'performerName' | 'authorName' | 'songTitle'
    > & { publicStatus?: MusicTrackPublicStatus },
    options?: UploadProgressOptions,
  ) => {
    const init = await apiFetch<MusicTrackUploadInit>('/music-tracks/r2/init', {
      method: 'POST',
      body: JSON.stringify({
        ...body,
        publicStatus: body.publicStatus ?? 'PUBLIC',
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        sizeBytes: file.size,
      }),
    });
    return finishTrackUpload(init, file, options);
  },

  updateTrack: (id: string, body: Partial<MusicTrack>) =>
    apiFetch<MusicTrack>(`/music-tracks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  deleteTrack: (id: string) =>
    apiFetch<{ ok: boolean; id?: string }>(`/music-tracks/${id}`, {
      method: 'DELETE',
    }),

  bulkDeleteTracks: (ids: string[]) =>
    apiFetch<{
      ok: boolean;
      removed: number;
      removedIds: string[];
      failed: Array<{ id: string; reason: string }>;
    }>(`/music-tracks/bulk-delete`, {
      method: 'POST',
      body: JSON.stringify({ ids }),
    }),

  uploadTrackAudio: async (
    id: string,
    file: File,
    options?: UploadProgressOptions,
  ) => {
    const init = await apiFetch<MusicTrackUploadInit>(
      `/music-tracks/${id}/r2/init`,
      {
        method: 'POST',
        body: JSON.stringify({
          fileName: file.name,
          mimeType: file.type || 'application/octet-stream',
          sizeBytes: file.size,
        }),
      },
    );
    return finishTrackUpload(init, file, options);
  },

  listCampaigns: () => apiFetch<VotingCampaign[]>('/voting-campaigns'),

  getCampaign: (id: string) =>
    apiFetch<VotingCampaignDetail>(`/voting-campaigns/${id}`),

  getStats: (id: string) =>
    apiFetch<VotingCampaignStats>(`/voting-campaigns/${id}/stats`),

  createCampaign: (body: {
    name: string;
    description?: string;
    startAt: string;
    endAt: string;
    status?: VotingCampaignStatus;
    maxTracksPerBallot?: number;
    resultPublishConfig?: Record<string, unknown>;
  }) =>
    apiFetch<VotingCampaign>('/voting-campaigns', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  updateCampaign: (id: string, body: Record<string, unknown>) =>
    apiFetch<VotingCampaign>(`/voting-campaigns/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  deleteCampaign: (id: string) =>
    apiFetch<{ ok: boolean; id: string }>(`/voting-campaigns/${id}`, {
      method: 'DELETE',
    }),

  addCampaignTrack: (campaignId: string, trackId: string, displayOrder?: number) =>
    apiFetch(`/voting-campaigns/${campaignId}/tracks`, {
      method: 'POST',
      body: JSON.stringify({ trackId, displayOrder }),
    }),

  removeCampaignTrack: (campaignId: string, linkId: string) =>
    apiFetch(`/voting-campaigns/${campaignId}/tracks/${linkId}`, {
      method: 'DELETE',
    }),

  setCampaignTracks: (campaignId: string, trackIds: string[]) =>
    apiFetch<VotingCampaignDetail>(`/voting-campaigns/${campaignId}/tracks`, {
      method: 'PUT',
      body: JSON.stringify({ trackIds }),
    }),

  publicListTracks: () =>
    apiFetch<MusicTrack[]>('/public/voting/tracks', { skipAuth: true }),

  publicGetBallot: (campaignId?: string) =>
    apiFetch<PublicVotingCampaign>(
      `/public/voting/ballot${campaignId ? `?campaignId=${encodeURIComponent(campaignId)}` : ''}`,
      { skipAuth: true },
    ),

  importCampaignTrackCodes: (campaignId: string, songCodes: string[]) =>
    apiFetch<{
      ok: boolean;
      imported: number;
      missingCodes: string[];
    }>(`/voting-campaigns/${campaignId}/tracks/import-song-codes`, {
      method: 'POST',
      body: JSON.stringify({ songCodes }),
    }),

  importCampaignVoters: (
    campaignId: string,
    voters: Array<{ employeeCode: string; fullName?: string; email?: string }>,
  ) =>
    apiFetch<{
      ok: boolean;
      imported: number;
      missingInEmployeeMaster: string[];
    }>(`/voting-campaigns/${campaignId}/voters/import`, {
      method: 'POST',
      body: JSON.stringify({ voters }),
    }),

  clearCampaignVoters: (campaignId: string) =>
    apiFetch<{ ok: boolean; removed: number }>(
      `/voting-campaigns/${campaignId}/voters`,
      { method: 'DELETE' },
    ),

  publicGetCampaign: (id: string) =>
    apiFetch<PublicVotingCampaign>(`/public/voting/campaigns/${id}`, {
      skipAuth: true,
    }),

  publicGetStats: (id: string) =>
    apiFetch<VotingCampaignStats>(`/public/voting/campaigns/${id}/stats`, {
      skipAuth: true,
    }),

  publicVerifyVoter: (
    campaignId: string,
    email: string,
    fullName: string,
    trackId?: string,
  ) =>
    apiFetch<
      | { ok: true; whitelistOptional: true }
      | { ok: false; reason: 'not_in_whitelist' }
      | {
          ok: true;
          employeeCode: string;
          fullName?: string | null;
          votesUsed: number;
          maxTracksPerBallot: number;
          votesRemaining: number | null;
          trackAlreadyVoted: boolean;
          votedTrackIds: string[];
        }
    >(`/public/voting/campaigns/${campaignId}/voters/verify`, {
      method: 'POST',
      skipAuth: true,
      body: JSON.stringify({
        email: email.trim(),
        fullName: fullName.trim(),
        ...(trackId ? { trackId } : {}),
      }),
    }),

  publicSubmitVote: (
    campaignId: string,
    trackIds: string[],
    voterKey: string,
    email?: string,
    fullName?: string,
  ) =>
    apiFetch<{ ok: boolean; acceptedTrackIds: string[] }>(
      `/public/voting/campaigns/${campaignId}/votes`,
      {
        method: 'POST',
        skipAuth: true,
        body: JSON.stringify({
          trackIds,
          voterKey,
          ...(email?.trim() ? { email: email.trim() } : {}),
          ...(fullName?.trim() ? { fullName: fullName.trim() } : {}),
        }),
      },
    ),
};
