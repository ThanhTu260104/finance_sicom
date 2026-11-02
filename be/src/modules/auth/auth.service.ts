import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UserAccessMode, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import {
  isSystemAdminEmail,
  normalizeAuthEmail,
  SYSTEM_ADMIN_EMAIL,
} from '../../common/constants/auth.constants';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthUserPayload, SafeAppUser } from './auth.types';
import { ChangePasswordDto, SetPasswordDto } from './dto/change-password.dto';
import { CreateAppUserDto } from './dto/create-app-user.dto';
import { LoginDto } from './dto/login.dto';
import { UserAccessDto } from './dto/user-access.dto';

const BCRYPT_ROUNDS = 10;

@Injectable()
export class AuthService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit() {
    await this.ensureDefaultAdmin();
  }

  private async ensureDefaultAdmin() {
    const email = normalizeAuthEmail(SYSTEM_ADMIN_EMAIL);
    const existing = await this.prisma.appUser.findUnique({ where: { email } });
    if (existing) return;

    const password =
      this.config.get<string>('ADMIN_INITIAL_PASSWORD') ?? '123456';
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    await this.prisma.appUser.create({
      data: {
        email,
        displayName: 'Quản trị hệ thống',
        passwordHash,
        role: UserRole.ADMIN,
      },
    });
  }

  async login(dto: LoginDto) {
    const email = normalizeAuthEmail(dto.email);
    const user = await this.prisma.appUser.findUnique({ where: { email } });
    if (!user) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }
    return this.buildAuthResponse(user);
  }

  async me(userId: string) {
    const user = await this.prisma.appUser.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('Phiên đăng nhập không hợp lệ');
    }
    return this.toSafeUser(user);
  }

  async listUsers(actor: AuthUserPayload): Promise<SafeAppUser[]> {
    if (actor.role !== UserRole.ADMIN || !isSystemAdminEmail(actor.email)) {
      throw new UnauthorizedException(
        'Chỉ tài khoản quản trị được phép xem danh sách người dùng',
      );
    }
    const rows = await this.prisma.appUser.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((u) => this.toSafeUser(u));
  }

  async createUser(dto: CreateAppUserDto, actor: AuthUserPayload) {
    if (actor.role !== UserRole.ADMIN || !isSystemAdminEmail(actor.email)) {
      throw new UnauthorizedException(
        'Chỉ tài khoản quản trị được phép tạo người dùng',
      );
    }

    const email = normalizeAuthEmail(dto.email);
    if (isSystemAdminEmail(email)) {
      throw new ConflictException('Email quản trị hệ thống đã tồn tại');
    }

    const exists = await this.prisma.appUser.findUnique({ where: { email } });
    if (exists) {
      throw new ConflictException('Email đã được sử dụng');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const created = await this.prisma.appUser.create({
      data: {
        displayName: dto.displayName.trim(),
        email,
        passwordHash,
        role: UserRole.USER,
        ...this.normalizeAccess(dto),
      },
    });
    return this.toSafeUser(created);
  }

  /** Admin đổi chế độ quyền / tính năng của một tài khoản (không áp cho admin hệ thống) */
  async updateUserAccess(
    userId: string,
    dto: UserAccessDto,
    actor: AuthUserPayload,
  ) {
    if (actor.role !== UserRole.ADMIN || !isSystemAdminEmail(actor.email)) {
      throw new UnauthorizedException(
        'Chỉ tài khoản quản trị được phép phân quyền',
      );
    }
    const target = await this.prisma.appUser.findUnique({
      where: { id: userId },
    });
    if (!target) {
      throw new NotFoundException('Không tìm thấy tài khoản');
    }
    if (target.role === UserRole.ADMIN) {
      throw new BadRequestException('Không giới hạn quyền tài khoản quản trị');
    }
    const updated = await this.prisma.appUser.update({
      where: { id: userId },
      data: this.normalizeAccess(dto),
    });
    return this.toSafeUser(updated);
  }

  /** Người dùng tự đổi mật khẩu (mọi chế độ quyền, kể cả chỉ xem) */
  async changeOwnPassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.appUser.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new UnauthorizedException('Phiên đăng nhập không hợp lệ');
    }
    const ok = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!ok) {
      throw new BadRequestException('Mật khẩu hiện tại không đúng');
    }
    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException('Mật khẩu mới phải khác mật khẩu cũ');
    }
    await this.prisma.appUser.update({
      where: { id: userId },
      data: { passwordHash: await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS) },
    });
    return { ok: true };
  }

  /** Admin đặt lại mật khẩu cho một tài khoản (không cần mật khẩu cũ) */
  async setUserPassword(
    userId: string,
    dto: SetPasswordDto,
    actor: AuthUserPayload,
  ) {
    if (actor.role !== UserRole.ADMIN || !isSystemAdminEmail(actor.email)) {
      throw new UnauthorizedException(
        'Chỉ tài khoản quản trị được phép đổi mật khẩu người dùng',
      );
    }
    const target = await this.prisma.appUser.findUnique({
      where: { id: userId },
    });
    if (!target) {
      throw new NotFoundException('Không tìm thấy tài khoản');
    }
    await this.prisma.appUser.update({
      where: { id: userId },
      data: { passwordHash: await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS) },
    });
    return { ok: true };
  }

  /** LIMITED phải có ít nhất một tính năng; FULL / READONLY thì xóa danh sách tính năng */
  private normalizeAccess(dto: UserAccessDto) {
    const accessMode = dto.accessMode ?? UserAccessMode.FULL;
    const permissions = [...new Set(dto.permissions ?? [])];
    if (accessMode === UserAccessMode.LIMITED && permissions.length === 0) {
      throw new BadRequestException(
        'Tài khoản giới hạn cần được cấp ít nhất một tính năng',
      );
    }
    return {
      accessMode,
      permissions: accessMode === UserAccessMode.LIMITED ? permissions : [],
    };
  }

  private buildAuthResponse(user: {
    id: string;
    email: string;
    role: UserRole;
    displayName: string;
    accessMode: UserAccessMode;
    permissions: string[];
  }) {
    // JWT chỉ mang định danh; quyền nạp lại từ DB ở JwtStrategy
    const accessToken = this.jwt.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
      displayName: user.displayName,
    });
    return {
      accessToken,
      user: this.toSafeUser(user),
    };
  }

  private toSafeUser(user: {
    id: string;
    displayName: string;
    email: string;
    role: UserRole;
    accessMode: UserAccessMode;
    permissions: string[];
    createdAt?: Date;
  }): SafeAppUser {
    return {
      id: user.id,
      displayName: user.displayName,
      email: user.email,
      role: user.role,
      accessMode: user.accessMode,
      permissions: user.permissions,
      createdAt: user.createdAt?.toISOString() ?? new Date().toISOString(),
    };
  }
}
