import { IsString, MinLength } from 'class-validator';

/** Người dùng tự đổi mật khẩu — phải nhập đúng mật khẩu hiện tại */
export class ChangePasswordDto {
  @IsString()
  @MinLength(1)
  currentPassword!: string;

  @IsString()
  @MinLength(6, { message: 'Mật khẩu mới tối thiểu 6 ký tự' })
  newPassword!: string;
}

/** Admin đặt lại mật khẩu cho tài khoản khác */
export class SetPasswordDto {
  @IsString()
  @MinLength(6, { message: 'Mật khẩu mới tối thiểu 6 ký tự' })
  newPassword!: string;
}
