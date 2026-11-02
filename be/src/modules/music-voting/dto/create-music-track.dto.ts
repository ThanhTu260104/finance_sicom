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
import {
  MusicTrackConversionStatus,
  MusicTrackPublicStatus,
} from '@prisma/client';

export class CreateMusicTrackDto {
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

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  originalFilePath?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  mp3FilePath?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  mimeType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fileSizeBytes?: string;

  @ApiPropertyOptional({ enum: MusicTrackConversionStatus })
  @IsOptional()
  @IsEnum(MusicTrackConversionStatus)
  conversionStatus?: MusicTrackConversionStatus;

  @ApiPropertyOptional({ enum: MusicTrackPublicStatus })
  @IsOptional()
  @IsEnum(MusicTrackPublicStatus)
  publicStatus?: MusicTrackPublicStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;
}
