/** Email duy nhất được quyền tạo tài khoản (ADMIN). */
export const SYSTEM_ADMIN_EMAIL = 'tr.thanhtu.dev@gmail.com';

export function normalizeAuthEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isSystemAdminEmail(email: string): boolean {
  return normalizeAuthEmail(email) === SYSTEM_ADMIN_EMAIL;
}
