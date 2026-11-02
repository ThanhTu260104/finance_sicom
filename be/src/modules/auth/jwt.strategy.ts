import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthUserPayload } from './auth.types';

type JwtClaims = {
  sub: string;
  email: string;
  role: AuthUserPayload['role'];
  displayName: string;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET') ?? 'finance-dev-jwt-secret',
    });
  }

  async validate(payload: JwtClaims): Promise<AuthUserPayload> {
    const user = await this.prisma.appUser.findUnique({
      where: { id: payload.sub },
    });
    if (!user) {
      throw new UnauthorizedException('Phiên đăng nhập không hợp lệ');
    }
    // Đọc quyền từ DB mỗi request → admin đổi quyền có hiệu lực ngay
    return {
      sub: user.id,
      email: user.email,
      role: user.role,
      displayName: user.displayName,
      accessMode: user.accessMode,
      permissions: user.permissions,
    };
  }
}
