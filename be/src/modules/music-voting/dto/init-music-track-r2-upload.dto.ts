import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { MusicTrackPublicStatus } from '@prisma/client';

export class InitMusicTrackR2UploadDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  songCode: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  contestantCode: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  performerName: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  authorName: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  songTitle: string;

  @ApiPropertyOptional({ enum: MusicTrackPublicStatus })
  @IsOptional()
  @IsEnum(MusicTrackPublicStatus)
  publicStatus?: MusicTrackPublicStatus;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  fileName: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  mimeType: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  sizeBytes: number;
}
