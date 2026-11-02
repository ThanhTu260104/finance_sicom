import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const expiresRaw = config.get<string>('JWT_EXPIRES_SECONDS');
        const expiresIn = expiresRaw
          ? Number.parseInt(expiresRaw, 10)
          : 60 * 60 * 24 * 7;
        return {
          secret: config.get<string>('JWT_SECRET') ?? 'finance-dev-jwt-secret',
          signOptions: { expiresIn: Number.isFinite(expiresIn) ? expiresIn : 604800 },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
