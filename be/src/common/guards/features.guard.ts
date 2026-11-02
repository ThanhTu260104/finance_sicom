import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserAccessMode, UserRole } from '@prisma/client';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import {
  ALLOW_FEATURES_KEY,
  ANY_USER_KEY,
} from '../decorators/feature.decorator';
import type { AuthUserPayload } from '../../modules/auth/auth.types';

const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Tài khoản LIMITED: **mặc định từ chối** mọi API, trừ API gắn @AnyUser()
 * hoặc @AllowFeature(...) có tính năng mà tài khoản được cấp.
 * Tài khoản READONLY: chỉ được gọi API đọc (GET / HEAD), trừ API gắn @AnyUser().
 * Tài khoản FULL và ADMIN: không giới hạn (RolesGuard vẫn áp dụng như cũ).
 */
@Injectable()
export class FeaturesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) {
      return true;
    }
    const { user } = context
      .switchToHttp()
      .getRequest<{ user?: AuthUserPayload }>();
    if (
      !user ||
      user.role === UserRole.ADMIN ||
      user.accessMode === UserAccessMode.FULL
    ) {
      return true;
    }
    if (this.reflector.getAllAndOverride<boolean>(ANY_USER_KEY, targets)) {
      return true;
    }
    if (user.accessMode === UserAccessMode.READONLY) {
      const { method } = context
        .switchToHttp()
        .getRequest<{ method: string }>();
      if (READ_METHODS.has(method.toUpperCase())) return true;
      throw new ForbiddenException(
        'Tài khoản chỉ xem — không được thêm, sửa hoặc xóa dữ liệu',
      );
    }
    const allowed =
      this.reflector.getAllAndOverride<string[]>(ALLOW_FEATURES_KEY, targets) ??
      [];
    if (allowed.some((f) => user.permissions.includes(f))) {
      return true;
    }
    throw new ForbiddenException(
      'Tài khoản của bạn không được cấp quyền dùng tính năng này',
    );
  }
}
