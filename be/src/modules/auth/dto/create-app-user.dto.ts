import { IsEmail, IsString, MinLength } from 'class-validator';
import { UserAccessDto } from './user-access.dto';

export class CreateAppUserDto extends UserAccessDto {
  @IsString()
  @MinLength(1)
  displayName!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  password!: string;
}
