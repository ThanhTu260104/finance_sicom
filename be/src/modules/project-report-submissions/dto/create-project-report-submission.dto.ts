import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';

const PERIOD_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export class ProjectReportSubmissionLineDto {
  @ApiProperty()
  @IsUUID()
  contractId!: string;

  @ApiProperty({ example: 625000000 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  reportedPlannedAmount!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}

export class CreateProjectReportSubmissionDto {
  @ApiProperty()
  @IsUUID()
  projectId!: string;

  @ApiProperty({ example: '2026-10' })
  @IsNotEmpty()
  @Matches(PERIOD_PATTERN)
  period!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;

  @ApiProperty({ type: [ProjectReportSubmissionLineDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ProjectReportSubmissionLineDto)
  lines!: ProjectReportSubmissionLineDto[];
}
