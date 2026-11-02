import { apiFetch } from './client';

export type AppUserRole = 'ADMIN' | 'USER';

/** FULL = mọi tính năng; LIMITED = chỉ các tính năng trong `permissions`; READONLY = xem tất cả, không ghi */
export type AppUserAccessMode = 'FULL' | 'LIMITED' | 'READONLY';

export type AppUser = {
  id: string;
  displayName: string;
  email: string;
  role: AppUserRole;
  accessMode: AppUserAccessMode;
  permissions: string[];
  createdAt: string;
};

export type UserAccessPayload = {
  accessMode: AppUserAccessMode;
  permissions: string[];
};

export type LoginResponse = {
  accessToken: string;
  user: AppUser;
};

export const authApi = {
  login(email: string, password: string) {
    return apiFetch<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
      skipAuth: true,
    });
  },
  me() {
    return apiFetch<AppUser>('/auth/me');
  },
  listUsers() {
    return apiFetch<AppUser[]>('/auth/users');
  },
  createUser(
    payload: {
      displayName: string;
      email: string;
      password: string;
    } & UserAccessPayload,
  ) {
    return apiFetch<AppUser>('/auth/users', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  updateUserAccess(userId: string, payload: UserAccessPayload) {
    return apiFetch<AppUser>(`/auth/users/${userId}/access`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },
  /** Tự đổi mật khẩu — mọi tài khoản (kể cả chỉ xem) */
  changePassword(currentPassword: string, newPassword: string) {
    return apiFetch<{ ok: boolean }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
      allowReadOnly: true,
    });
  },
  /** Admin đặt lại mật khẩu cho tài khoản khác */
  setUserPassword(userId: string, newPassword: string) {
    return apiFetch<{ ok: boolean }>(`/auth/users/${userId}/password`, {
      method: 'PATCH',
      body: JSON.stringify({ newPassword }),
    });
  },
};

export const SYSTEM_ADMIN_EMAIL = 'tr.thanhtu.dev@gmail.com';

export function isSystemAdmin(user: AppUser | null | undefined) {
  if (!user) return false;
  return (
    user.role === 'ADMIN' &&
    user.email.toLowerCase() === SYSTEM_ADMIN_EMAIL.toLowerCase()
  );
}
