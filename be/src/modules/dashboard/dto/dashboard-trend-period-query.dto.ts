import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, Matches } from 'class-validator';
import { DashboardOverviewQueryDto } from './dashboard-overview-query.dto';

const PERIOD_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export class DashboardTrendPeriodQueryDto extends DashboardOverviewQueryDto {
  @ApiProperty({ example: '2026-10', description: 'Tháng cần xem chi tiết theo dự án' })
  @IsNotEmpty()
  @Matches(PERIOD_PATTERN)
  period!: string;
}
