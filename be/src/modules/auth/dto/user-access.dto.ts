import { ApiPropertyOptional } from '@nestjs/swagger';
import { UserAccessMode } from '@prisma/client';
import { IsArray, IsEnum, IsIn, IsOptional } from 'class-validator';
import { FEATURE_KEYS } from '../../../common/constants/features';

/** Chế độ quyền + danh sách tính năng (dùng khi tạo / sửa tài khoản) */
export class UserAccessDto {
  @ApiPropertyOptional({ enum: UserAccessMode, default: UserAccessMode.FULL })
  @IsOptional()
  @IsEnum(UserAccessMode)
  accessMode?: UserAccessMode;

  @ApiPropertyOptional({ enum: FEATURE_KEYS, isArray: true })
  @IsOptional()
  @IsArray()
  @IsIn(FEATURE_KEYS, {
    each: true,
    message: `Tính năng không hợp lệ (${FEATURE_KEYS.join(', ')})`,
  })
  permissions?: string[];
}
