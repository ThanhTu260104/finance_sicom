import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserAccessMode, UserRole } from '@prisma/client';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import {
  ALLOW_FEATURES_KEY,
  ANY_USER_KEY,
} from '../decorators/feature.decorator';
import { FEATURES } from '../constants/features';
import { FeaturesGuard } from './features.guard';

type Meta = { public?: boolean; anyUser?: boolean; features?: string[] };

function run(
  user: Record<string, unknown> | undefined,
  method: string,
  meta: Meta = {},
) {
  const reflector = {
    getAllAndOverride: (key: string) =>
      key === IS_PUBLIC_KEY
        ? meta.public
        : key === ANY_USER_KEY
          ? meta.anyUser
          : key === ALLOW_FEATURES_KEY
            ? meta.features
            : undefined,
  } as unknown as Reflector;
  const context = {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => ({ user, method }) }),
  } as unknown as ExecutionContext;
  return new FeaturesGuard(reflector).canActivate(context);
}

const user = (accessMode: UserAccessMode, permissions: string[] = []) => ({
  sub: 'u1',
  email: 'u@example.com',
  role: UserRole.USER,
  accessMode,
  permissions,
});

describe('FeaturesGuard', () => {
  it('FULL và ADMIN không bị giới hạn', () => {
    expect(run(user(UserAccessMode.FULL), 'DELETE')).toBe(true);
    expect(
      run({ ...user(UserAccessMode.READONLY), role: UserRole.ADMIN }, 'POST'),
    ).toBe(true);
  });

  describe('READONLY', () => {
    const readonly = user(UserAccessMode.READONLY);

    it('được gọi mọi API đọc', () => {
      expect(run(readonly, 'GET')).toBe(true);
      expect(run(readonly, 'HEAD')).toBe(true);
    });

    it.each(['POST', 'PATCH', 'PUT', 'DELETE'])('chặn %s', (method) => {
      expect(() => run(readonly, method)).toThrow(ForbiddenException);
      expect(() =>
        run(readonly, method, { features: [FEATURES.CONTRACTS_CREATE] }),
      ).toThrow(ForbiddenException);
    });

    it('API @AnyUser / @Public vẫn dùng được', () => {
      expect(run(readonly, 'POST', { anyUser: true })).toBe(true);
      expect(run(undefined, 'POST', { public: true })).toBe(true);
    });
  });

  describe('LIMITED', () => {
    it('chỉ API có tính năng được cấp', () => {
      const limited = user(UserAccessMode.LIMITED, [FEATURES.CONTRACTS_LIST]);
      expect(run(limited, 'GET', { features: [FEATURES.CONTRACTS_LIST] })).toBe(
        true,
      );
      expect(() => run(limited, 'GET')).toThrow(ForbiddenException);
      expect(() =>
        run(limited, 'POST', { features: [FEATURES.CONTRACTS_CREATE] }),
      ).toThrow(ForbiddenException);
    });
  });
});
