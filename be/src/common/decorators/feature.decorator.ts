import { SetMetadata } from '@nestjs/common';
import type { FeatureKey } from '../constants/features';

export const ALLOW_FEATURES_KEY = 'allowFeatures';
export const ANY_USER_KEY = 'anyAuthenticatedUser';

/**
 * Tài khoản LIMITED được gọi API này nếu có ít nhất một tính năng trong danh sách.
 * Tài khoản FULL / ADMIN không bị ảnh hưởng.
 */
export const AllowFeature = (...features: FeatureKey[]) =>
  SetMetadata(ALLOW_FEATURES_KEY, features);

/** Mọi tài khoản đã đăng nhập (kể cả LIMITED) — vd. /auth/me */
export const AnyUser = () => SetMetadata(ANY_USER_KEY, true);
