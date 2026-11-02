import type { AppUser } from '@/lib/api/auth';

/**
 * Danh mục tính năng phân quyền (khớp BE `common/constants/features.ts`).
 * Mỗi tính năng khai báo trang mà tài khoản giới hạn được vào.
 */
export type FeatureKey = 'contracts.create' | 'contracts.list';

export type FeatureDef = {
  key: FeatureKey;
  label: string;
  description: string;
  /** Trang mở cho tính năng (mục menu của tài khoản giới hạn) */
  href: string;
  /** Đường dẫn thuộc tính năng — so khớp tiền tố (kể cả trang con) */
  paths?: string[];
  /** Đường dẫn khớp chính xác (không gồm trang con, vd. chi tiết HĐ) */
  exactPaths?: string[];
  /** Tính năng ghi dữ liệu — tài khoản chỉ xem không có */
  write?: boolean;
};

export const FEATURES: FeatureDef[] = [
  {
    key: 'contracts.list',
    label: 'Xem danh sách hợp đồng',
    description:
      'Xem danh sách HĐ (3 tab CĐT / thầu phụ / NCC, lọc, tìm kiếm). Không mở chi tiết, không sửa / xóa, không thống kê.',
    href: '/contracts',
    exactPaths: ['/contracts'],
  },
  {
    key: 'contracts.create',
    label: 'Thêm hợp đồng',
    description:
      'Tạo hợp đồng mới (CĐT / thầu phụ / NCC). Không sửa, xóa hay xem dashboard.',
    href: '/contracts/new',
    paths: ['/contracts/new'],
    write: true,
  },
];

export function isLimitedUser(user: AppUser | null | undefined) {
  return !!user && user.role !== 'ADMIN' && user.accessMode === 'LIMITED';
}

/** Tính năng tài khoản giới hạn được dùng (rỗng với tài khoản toàn quyền) */
export function userFeatures(user: AppUser | null | undefined): FeatureDef[] {
  if (!isLimitedUser(user)) return [];
  return FEATURES.filter((f) => user!.permissions.includes(f.key));
}

/** Trang hướng dẫn sử dụng — mọi tài khoản đều xem được */
export const GUIDE_PATH = '/guide';

/** Tài khoản giới hạn chỉ vào được trang của tính năng đã cấp */
export function isPathAllowed(
  user: AppUser | null | undefined,
  pathname: string,
): boolean {
  if (pathname === GUIDE_PATH) return true;
  if (isReadOnlyUser(user)) return !isWritePath(pathname);
  if (!isLimitedUser(user)) return true;
  return userFeatures(user).some((f) => featureMatchesPath(f, pathname));
}

/** Đường dẫn có thuộc tính năng không (exactPaths khớp đúng, paths khớp cả trang con) */
export function featureMatchesPath(feature: FeatureDef, pathname: string) {
  return (
    (feature.exactPaths ?? []).includes(pathname) ||
    (feature.paths ?? []).some(
      (p) => pathname === p || pathname.startsWith(`${p}/`),
    )
  );
}

/** Tài khoản chỉ xem: vào được mọi trang (trừ trang thêm / sửa), không ghi dữ liệu */
export function isReadOnlyUser(user: AppUser | null | undefined) {
  return !!user && user.role !== 'ADMIN' && user.accessMode === 'READONLY';
}

/** Được thêm / sửa / xóa dữ liệu không (tài khoản chỉ xem → false) */
export function canWrite(user: AppUser | null | undefined) {
  return !!user && !isReadOnlyUser(user);
}

/** Trang thêm / sửa (…/new, …/edit, nhập nhanh) — tài khoản chỉ xem không vào được */
export function isWritePath(pathname: string) {
  return (
    /\/(new|edit)(\/|$)/.test(pathname) || pathname.startsWith('/quick-entry')
  );
}

/** Tài khoản toàn quyền → true; tài khoản giới hạn → chỉ khi được cấp tính năng */
export function hasFeature(
  user: AppUser | null | undefined,
  key: FeatureKey,
): boolean {
  if (!user) return false;
  if (isReadOnlyUser(user)) {
    return !FEATURES.find((f) => f.key === key)?.write;
  }
  if (!isLimitedUser(user)) return true;
  return user.permissions.includes(key);
}

export function limitedHomeHref(user: AppUser | null | undefined) {
  if (isReadOnlyUser(user)) return '/';
  return userFeatures(user)[0]?.href ?? '/login';
}
