const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3002/api/v1';

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
    const message = Array.isArray(body?.message)
      ? body.message.join(', ')
      : body?.message || res.statusText || 'Request failed';
    return { message: message as string, body };
  } catch {
    return { message: res.statusText || 'Request failed' };
  }
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  const isFormData =
    typeof FormData !== 'undefined' && options.body instanceof FormData;
  if (options.body && !headers.has('Content-Type') && !isFormData) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    cache: 'no-store',
  });

  if (!res.ok) {
    const error = await parseError(res);
    throw new ApiError(error.message, res.status, error.body);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
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
