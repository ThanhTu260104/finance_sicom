import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { VotingCampaignStatus } from '@prisma/client';

export class CreateVotingCampaignDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: '2026-10-01T00:00:00.000Z' })
  @IsDateString()
  startAt: string;

  @ApiProperty({ example: '2026-10-31T23:59:59.000Z' })
  @IsDateString()
  endAt: string;

  @ApiPropertyOptional({ enum: VotingCampaignStatus })
  @IsOptional()
  @IsEnum(VotingCampaignStatus)
  status?: VotingCampaignStatus;

  @ApiPropertyOptional({ description: '0 = không giới hạn số bài / lượt' })
  @IsOptional()
  @IsInt()
  @Min(0)
  maxTracksPerBallot?: number;

  @ApiPropertyOptional({ description: 'JSON cấu hình công bố kết quả' })
  @IsOptional()
  resultPublishConfig?: Record<string, unknown>;
}
