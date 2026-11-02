import {
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { JwtService } from '@nestjs/jwt';
import { UserAccessMode, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { SYSTEM_ADMIN_EMAIL } from '../../common/constants/auth.constants';
import type { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from './auth.service';
import type { AuthUserPayload } from './auth.types';

// @nestjs/config, @nestjs/jwt là ESM — jest (CommonJS) không nạp được; service chỉ cần chúng cho DI
jest.mock('@nestjs/config', () => ({ ConfigService: class {} }));
jest.mock('@nestjs/jwt', () => ({ JwtService: class {} }));

type UpdateArgs = { data: { passwordHash: string } };

function setup(stored: { id: string; passwordHash: string } | null) {
  const update = jest.fn<Promise<object>, [UpdateArgs]>().mockResolvedValue({});
  const prisma = {
    appUser: {
      findUnique: jest.fn().mockResolvedValue(stored),
      update,
    },
  } as unknown as PrismaService;
  const service = new AuthService(
    prisma,
    {} as JwtService,
    {} as ConfigService,
  );
  return { service, update };
}

const actor = (email: string, role: UserRole): AuthUserPayload => ({
  sub: 'actor',
  email,
  displayName: 'Actor',
  role,
  accessMode: UserAccessMode.FULL,
  permissions: [],
});

describe('AuthService — đổi mật khẩu', () => {
  let oldHash: string;
  beforeAll(async () => {
    oldHash = await bcrypt.hash('old-pass', 4);
  });

  describe('changeOwnPassword', () => {
    it('đổi được khi mật khẩu hiện tại đúng', async () => {
      const { service, update } = setup({ id: 'u1', passwordHash: oldHash });
      await expect(
        service.changeOwnPassword('u1', {
          currentPassword: 'old-pass',
          newPassword: 'new-pass',
        }),
      ).resolves.toEqual({ ok: true });
      const saved = update.mock.calls[0][0].data.passwordHash;
      expect(await bcrypt.compare('new-pass', saved)).toBe(true);
    });

    it('sai mật khẩu hiện tại → 400, không lưu', async () => {
      const { service, update } = setup({ id: 'u1', passwordHash: oldHash });
      await expect(
        service.changeOwnPassword('u1', {
          currentPassword: 'wrong',
          newPassword: 'new-pass',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(update).not.toHaveBeenCalled();
    });

    it('mật khẩu mới trùng mật khẩu cũ → 400', async () => {
      const { service } = setup({ id: 'u1', passwordHash: oldHash });
      await expect(
        service.changeOwnPassword('u1', {
          currentPassword: 'old-pass',
          newPassword: 'old-pass',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('setUserPassword', () => {
    it('admin hệ thống đặt lại được', async () => {
      const { service, update } = setup({ id: 'u2', passwordHash: oldHash });
      await service.setUserPassword(
        'u2',
        { newPassword: 'reset-123' },
        actor(SYSTEM_ADMIN_EMAIL, UserRole.ADMIN),
      );
      const saved = update.mock.calls[0][0].data.passwordHash;
      expect(await bcrypt.compare('reset-123', saved)).toBe(true);
    });

    it('không phải admin hệ thống → từ chối', async () => {
      const { service, update } = setup({ id: 'u2', passwordHash: oldHash });
      await expect(
        service.setUserPassword(
          'u2',
          { newPassword: 'reset-123' },
          actor('someone@example.com', UserRole.USER),
        ),
      ).rejects.toThrow(UnauthorizedException);
      expect(update).not.toHaveBeenCalled();
    });

    it('tài khoản không tồn tại → 404', async () => {
      const { service } = setup(null);
      await expect(
        service.setUserPassword(
          'nope',
          { newPassword: 'reset-123' },
          actor(SYSTEM_ADMIN_EMAIL, UserRole.ADMIN),
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
