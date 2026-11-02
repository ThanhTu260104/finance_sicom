import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { AnyUser } from '../../common/decorators/feature.decorator';
import { UserAccessDto } from './dto/user-access.dto';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { AuthUserPayload } from './auth.types';
import { AuthService } from './auth.service';
import { ChangePasswordDto, SetPasswordDto } from './dto/change-password.dto';
import { CreateAppUserDto } from './dto/create-app-user.dto';
import { LoginDto } from './dto/login.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Đăng nhập' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Get('me')
  @AnyUser()
  @ApiOperation({ summary: 'Thông tin phiên đăng nhập' })
  me(@CurrentUser() user: AuthUserPayload) {
    return this.authService.me(user.sub);
  }

  @Post('change-password')
  @AnyUser()
  @ApiOperation({ summary: 'Tự đổi mật khẩu (cần mật khẩu hiện tại)' })
  changePassword(
    @Body() dto: ChangePasswordDto,
    @CurrentUser() user: AuthUserPayload,
  ) {
    return this.authService.changeOwnPassword(user.sub, dto);
  }

  @Get('users')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Danh sách tài khoản (admin)' })
  listUsers(@CurrentUser() user: AuthUserPayload) {
    return this.authService.listUsers(user);
  }

  @Post('users')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Tạo tài khoản (chỉ admin hệ thống)' })
  createUser(
    @Body() dto: CreateAppUserDto,
    @CurrentUser() user: AuthUserPayload,
  ) {
    return this.authService.createUser(dto, user);
  }

  @Patch('users/:id/access')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Phân quyền tính năng cho tài khoản (admin)' })
  updateUserAccess(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UserAccessDto,
    @CurrentUser() user: AuthUserPayload,
  ) {
    return this.authService.updateUserAccess(id, dto, user);
  }

  @Patch('users/:id/password')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Đặt lại mật khẩu cho tài khoản (admin)' })
  setUserPassword(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetPasswordDto,
    @CurrentUser() user: AuthUserPayload,
  ) {
    return this.authService.setUserPassword(id, dto, user);
  }
}
