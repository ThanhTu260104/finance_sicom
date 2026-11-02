import { getStoredAuthToken } from '@/lib/auth-storage';
import { API_URL, apiFetch, ApiError } from './client';

export type InitStagedUploadResponse = {
  fileId: string;
  uploadUrl: string;
  method: 'PUT';
  uploadTarget: 'local' | 'r2';
  expiresAt: string;
  headers: { 'Content-Type': string };
};

function isDirectCloudUploadUrl(uploadUrl: string) {
  return /^https?:\/\//i.test(uploadUrl);
}

export async function initProjectReportStagedUpload(
  input: { fileName: string; mimeType: string; sizeBytes: number },
  options?: { skipAuth?: boolean },
): Promise<InitStagedUploadResponse> {
  return apiFetch<InitStagedUploadResponse>(
    '/project-report-staged-files/init',
    {
      method: 'POST',
      body: JSON.stringify(input),
      skipAuth: options?.skipAuth,
    },
  );
}

/** Upload thẳng lên storage (PUT stream) — có progress 0–100. */
export function putProjectReportStagedFile(
  uploadUrl: string,
  file: File,
  headers: Record<string, string>,
  onProgress: (percent: number) => void,
  options?: { skipAuth?: boolean; useBearer?: boolean },
): Promise<void> {
  const path = isDirectCloudUploadUrl(uploadUrl)
    ? uploadUrl
    : `${API_URL}${uploadUrl.startsWith('/') ? '' : '/'}${uploadUrl}`;

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', path);
    xhr.timeout = 0;

    const sendBearer =
      options?.useBearer !== false &&
      !isDirectCloudUploadUrl(uploadUrl) &&
      !options?.skipAuth;
    const token = sendBearer ? getStoredAuthToken() : null;
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    for (const [k, v] of Object.entries(headers)) {
      xhr.setRequestHeader(k, v);
    }

    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable && ev.total > 0) {
        onProgress(Math.min(100, Math.round((ev.loaded / ev.total) * 100)));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100);
        resolve();
        return;
      }
      let message = xhr.statusText || 'Upload thất bại';
      try {
        const body = JSON.parse(xhr.responseText) as { message?: string | string[] };
        const raw = body.message;
        if (Array.isArray(raw)) message = raw.join(' · ');
        else if (typeof raw === 'string') message = raw;
      } catch {
        /* ignore */
      }
      reject(new ApiError(message, xhr.status));
    };

    xhr.onerror = () =>
      reject(new ApiError('Lỗi mạng khi tải file lên', 0));
    xhr.onabort = () =>
      reject(new ApiError('Upload bị hủy', 0));

    xhr.send(file);
  });
}

export async function completeProjectReportStagedUpload(
  fileId: string,
  options?: { skipAuth?: boolean },
) {
  return apiFetch<{ ok: boolean; sizeBytes: number }>(
    `/project-report-staged-files/${fileId}/complete`,
    { method: 'POST', skipAuth: options?.skipAuth },
  );
}

/** Upload một file — trả về staged fileId trên server. */
export async function uploadOneProjectReportFile(
  file: File,
  onProgress: (percent: number) => void,
  options?: { skipAuth?: boolean },
): Promise<string> {
  const init = await initProjectReportStagedUpload(
    {
      fileName: file.name,
      mimeType: file.type || 'application/octet-stream',
      sizeBytes: file.size,
    },
    options,
  );
  await putProjectReportStagedFile(
    init.uploadUrl,
    file,
    init.headers,
    onProgress,
    {
      skipAuth: options?.skipAuth,
      useBearer: init.uploadTarget === 'local',
    },
  );
  if (init.uploadTarget === 'r2') {
    await completeProjectReportStagedUpload(init.fileId, options);
  }
  return init.fileId;
}

export async function uploadProjectReportFilesWithProgress(
  files: File[],
  onFileProgress: (fileIndex: number, percent: number) => void,
  options?: { skipAuth?: boolean },
): Promise<string[]> {
  return Promise.all(
    files.map((file, i) =>
      uploadOneProjectReportFile(
        file,
        (pct) => onFileProgress(i, pct),
        options,
      ),
    ),
  );
}
