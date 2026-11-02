import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PERIOD_REGEX } from '../../../common/constants/period';

export class QueryProjectOperatingCostDto {
  @ApiPropertyOptional({
    example: '2026-09',
    description: 'Một tháng cụ thể (ưu tiên hơn from/to khi có)',
  })
  @IsOptional()
  @IsString()
  @Matches(PERIOD_REGEX, { message: 'period must be YYYY-MM' })
  period?: string;

  @ApiPropertyOptional({ example: '2026-01' })
  @IsOptional()
  @Matches(PERIOD_REGEX, { message: 'fromPeriod must be YYYY-MM' })
  fromPeriod?: string;

  @ApiPropertyOptional({ example: '2026-12' })
  @IsOptional()
  @Matches(PERIOD_REGEX, { message: 'toPeriod must be YYYY-MM' })
  toPeriod?: string;

  @ApiPropertyOptional({
    example: 2026,
    description: 'Lọc theo năm (giao với from/to)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year?: number;
}
