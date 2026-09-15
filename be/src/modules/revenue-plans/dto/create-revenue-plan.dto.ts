import {
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { PERIOD_REGEX } from '../../../common/constants/period';

/** Period format: YYYY-MM (e.g. 2026-08). Extensible for other granularities later. */
export class CreateRevenuePlanDto {
  @ApiProperty({ example: '2026-08', description: 'Period as YYYY-MM' })
  @IsString()
  @Matches(PERIOD_REGEX, {
    message: 'period must be in YYYY-MM format',
  })
  period: string;

  @ApiProperty({ example: 2413928483 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  plannedAmount: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}
