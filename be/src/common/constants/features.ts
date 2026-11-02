/**
 * Danh mục tính năng phân quyền cho tài khoản chế độ LIMITED.
 * Thêm tính năng mới: khai báo ở đây + gắn @AllowFeature(...) lên các API nó cần
 * (kể cả API đọc danh mục mà form của tính năng dùng). Giữ khớp với FE `lib/features.ts`.
 */
export const FEATURES = {
  CONTRACTS_CREATE: 'contracts.create',
  /** Chỉ xem danh sách HĐ — không xem chi tiết / sửa / xóa */
  CONTRACTS_LIST: 'contracts.list',
} as const;

export type FeatureKey = (typeof FEATURES)[keyof typeof FEATURES];

export const FEATURE_KEYS: FeatureKey[] = Object.values(FEATURES);

export function isFeatureKey(value: string): value is FeatureKey {
  return (FEATURE_KEYS as string[]).includes(value);
}
