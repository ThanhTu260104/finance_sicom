import { getStoredAuthToken } from '@/lib/auth-storage';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3004/api/v1';

export type ApiFetchOptions = RequestInit & {
  timeoutMs?: number;
  /** Không gửi Bearer (đăng nhập) */
  skipAuth?: boolean;
  /** Vẫn gửi khi tài khoản chỉ xem (vd. tự đổi mật khẩu — BE dùng @AnyUser) */
  allowReadOnly?: boolean;
};

let readOnlyMode = false;

/** Tài khoản chỉ xem: chặn mọi request ghi ngay ở client (BE cũng chặn) */
export function setApiReadOnly(value: boolean) {
  readOnlyMode = value;
}

export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

async function parseError(res: Response) {
  try {
    const body = await res.json();
    const raw = body?.message;
    let message: string;
    if (Array.isArray(raw)) {
      message = raw.join(' · ');
    } else if (typeof raw === 'string' && raw.trim()) {
      message = raw;
    } else if (body?.error && typeof body.error === 'string') {
      message = body.error;
    } else {
      message = res.statusText || 'Request failed';
    }
    if (res.status >= 500 && !Array.isArray(raw) && message === res.statusText) {
      message =
        'Lỗi máy chủ khi lưu dữ liệu. Kiểm tra mã trùng / email / trường bắt buộc rồi thử lại.';
    }
    return { message, body };
  } catch {
    return {
      message:
        res.status >= 500
          ? 'Lỗi máy chủ khi lưu dữ liệu. Vui lòng thử lại hoặc kiểm tra file nhập.'
          : res.statusText || 'Request failed',
    };
  }
}

function networkErrorMessage(err: unknown): string {
  if (err instanceof DOMException && err.name === 'AbortError') {
    return 'Hết thời gian tải lên / kết nối bị hủy. Thử lại với file nhỏ hơn hoặc kiểm tra API.';
  }
  if (err instanceof TypeError) {
    return `Không kết nối được API (${API_URL}). Kiểm tra backend đang chạy và NEXT_PUBLIC_API_URL.`;
  }
  if (err instanceof Error && err.message) return err.message;
  return 'Lỗi mạng khi gọi API';
}

/** Tải file binary (đính kèm) kèm Bearer token. */
export async function apiDownloadBlob(
  path: string,
  options: Pick<ApiFetchOptions, 'timeoutMs' | 'skipAuth' | 'signal'> = {},
): Promise<Blob> {
  const { timeoutMs, skipAuth, signal } = options;
  const headers = new Headers();
  if (!skipAuth) {
    const token = getStoredAuthToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }

  const ms = timeoutMs ?? 120_000;
  const controller = new AbortController();
  const onExternalAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener('abort', onExternalAbort, { once: true });
  }
  const timer = setTimeout(() => controller.abort(), ms);

  try {
    const res = await fetch(`${API_URL}${path}`, {
      method: 'GET',
      headers,
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!res.ok) {
      const error = await parseError(res);
      throw new ApiError(error.message, res.status, error.body);
    }
    return await res.blob();
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(networkErrorMessage(err), 0);
  } finally {
    clearTimeout(timer);
    if (signal) {
      signal.removeEventListener('abort', onExternalAbort);
    }
  }
}

export async function apiFetch<T>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const { timeoutMs, skipAuth, allowReadOnly, ...fetchOptions } = options;
  const method = (fetchOptions.method ?? 'GET').toUpperCase();
  if (
    readOnlyMode &&
    !skipAuth &&
    !allowReadOnly &&
    method !== 'GET' &&
    method !== 'HEAD'
  ) {
    throw new ApiError(
      'Tài khoản chỉ xem — không được thêm, sửa hoặc xóa dữ liệu',
      403,
    );
  }
  const headers = new Headers(fetchOptions.headers);
  const isFormData =
    typeof FormData !== 'undefined' && fetchOptions.body instanceof FormData;
  if (fetchOptions.body && !headers.has('Content-Type') && !isFormData) {
    headers.set('Content-Type', 'application/json');
  }
  if (!skipAuth && !headers.has('Authorization')) {
    const token = getStoredAuthToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }

  const defaultTimeout = isFormData ? 120_000 : 60_000;
  const ms = timeoutMs ?? defaultTimeout;
  const controller = new AbortController();
  const externalSignal = fetchOptions.signal;
  const onExternalAbort = () => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) controller.abort();
    else externalSignal.addEventListener('abort', onExternalAbort, { once: true });
  }
  const timer = setTimeout(() => controller.abort(), ms);

  try {
    const res = await fetch(`${API_URL}${path}`, {
      ...fetchOptions,
      headers,
      cache: 'no-store',
      signal: controller.signal,
    });

    if (!res.ok) {
      const error = await parseError(res);
      throw new ApiError(error.message, res.status, error.body);
    }

    if (res.status === 204) {
      return undefined as T;
    }

    return (await res.json()) as T;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(networkErrorMessage(err), 0);
  } finally {
    clearTimeout(timer);
    if (externalSignal) {
      externalSignal.removeEventListener('abort', onExternalAbort);
    }
  }
}

export function buildQuery(
  params: Record<string, string | number | undefined | null>,
) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, String(value));
    }
  });
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

export { API_URL };
