import {
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { PERIOD_REGEX } from '../../../common/constants/period';

/** Period format: YYYY-MM (e.g. 2026-08). Extensible for other granularities later. */
export class CreateRevenuePlanDto {
  @ApiPropertyOptional({ example: '2026-08', description: 'Kỳ báo cáo (mặc định = tháng của đến ngày)' })
  @IsOptional()
  @IsString()
  @Matches(PERIOD_REGEX, {
    message: 'period must be in YYYY-MM format',
  })
  period?: string;

  @ApiPropertyOptional({ example: 1, description: 'Số đợt NT' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  batchSequence?: number;

  @ApiPropertyOptional({ example: '2026-07-10' })
  @IsOptional()
  @IsDateString()
  periodStartDate?: string;

  @ApiPropertyOptional({ example: '2026-09-30' })
  @IsOptional()
  @IsDateString()
  periodEndDate?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  scheduleId?: string;

  @ApiProperty({ example: 2413928483 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  plannedAmount: number;

  @ApiPropertyOptional({
    example: '2026-09-30',
    description: 'Ngày nghiệm thu dự kiến (YYYY-MM-DD)',
  })
  @IsOptional()
  @IsDateString()
  plannedAcceptanceDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}
