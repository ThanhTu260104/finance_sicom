import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsString,
  IsOptional,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class SubmitVoteDto {
  @ApiProperty({ type: [String], description: 'Danh sách trackId trong đợt' })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @IsUUID('4', { each: true })
  trackIds: string[];

  @ApiProperty({
    description: 'Khóa cố định phía client (session/device) — chống spam',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(128)
  voterKey: string;

  @ApiPropertyOptional({
    description:
      'Email — bắt buộc khi đợt đã import whitelist nhân viên',
  })
  @IsOptional()
  @IsString()
  @MaxLength(256)
  email?: string;

  @ApiPropertyOptional({
    description: 'Họ tên — bắt buộc khi đợt đã import whitelist',
  })
  @IsOptional()
  @IsString()
  @MaxLength(256)
  fullName?: string;
}
