import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsUUID,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { PERIOD_REGEX } from '../../../common/constants/period';

export class OperatingCostTrendQueryDto {
  @ApiPropertyOptional({
    example: 2026,
    description: 'Lọc theo năm lịch (YYYY-01 … YYYY-12), giao với from/to',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year?: number;

  @ApiPropertyOptional({ example: '2026-01' })
  @IsOptional()
  @Matches(PERIOD_REGEX, { message: 'fromPeriod must be YYYY-MM' })
  fromPeriod?: string;

  @ApiPropertyOptional({ example: '2026-12' })
  @IsOptional()
  @Matches(PERIOD_REGEX, { message: 'toPeriod must be YYYY-MM' })
  toPeriod?: string;

  @ApiPropertyOptional({ description: 'Lọc một dự án (dashboard)' })
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @ApiPropertyOptional({ description: 'Lọc theo khách hàng (dashboard)' })
  @IsOptional()
  @IsUUID()
  customerId?: string;
}
