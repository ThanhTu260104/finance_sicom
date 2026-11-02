import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { DashboardOverviewQueryDto } from './dashboard-overview-query.dto';

export const TIMELINE_SORT_FIELDS = [
  'endDate',
  'startDate',
  'contractValue',
  'contractNo',
  'acceptanceGap',
  'acceptancePercent',
] as const;

export type TimelineSortField = (typeof TIMELINE_SORT_FIELDS)[number];

export class DashboardTimelineQueryDto extends DashboardOverviewQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number = 30;

  @ApiPropertyOptional({ enum: TIMELINE_SORT_FIELDS, default: 'endDate' })
  @IsOptional()
  @IsIn(TIMELINE_SORT_FIELDS)
  sort?: TimelineSortField = 'endDate';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'asc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc' = 'asc';
}
