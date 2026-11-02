import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class VerifyCampaignVoterDto {
  @ApiProperty({ description: 'Email công ty (khớp whitelist)' })
  @IsString()
  @IsNotEmpty()
  @IsEmail()
  @MaxLength(256)
  email: string;

  @ApiProperty({ description: 'Họ tên nhân viên (khớp whitelist)' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(256)
  fullName: string;

  @ApiPropertyOptional({ description: 'Ca khúc dự định bình chọn' })
  @IsOptional()
  @IsUUID('4')
  trackId?: string;
}
