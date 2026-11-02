import { ApiPropertyOptional } from '@nestjs/swagger';
import { ContractStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsUUID,
  Matches,
  Max,
  Min,
} from 'class-validator';

const PERIOD_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export class DashboardOverviewQueryDto {
  @ApiPropertyOptional({
    example: 2026,
    description: 'Lọc theo năm lịch (giao với from/to)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year?: number;

  @ApiPropertyOptional({ example: '2026-01' })
  @IsOptional()
  @Matches(PERIOD_PATTERN)
  fromPeriod?: string;

  @ApiPropertyOptional({ example: '2026-12' })
  @IsOptional()
  @Matches(PERIOD_PATTERN)
  toPeriod?: string;

  @ApiPropertyOptional({
    example: '2026-09',
    description: 'Tháng tham chiếu cho KPI (mặc định = tháng hiện tại)',
  })
  @IsOptional()
  @Matches(PERIOD_PATTERN)
  kpiPeriod?: string;

  @ApiPropertyOptional({
    example: '2026-09',
    description:
      'Tháng tham chiếu cho danh sách Cần xử lý (mặc định = tháng hiện tại)',
  })
  @IsOptional()
  @Matches(PERIOD_PATTERN)
  actionPeriod?: string;

  @ApiPropertyOptional({
    example: '2026-09',
    description:
      'Tháng tham chiếu KPI chi tiết theo dự án (mặc định = tháng hiện tại)',
  })
  @IsOptional()
  @Matches(PERIOD_PATTERN)
  projectPeriod?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @ApiPropertyOptional({ enum: ContractStatus })
  @IsOptional()
  @IsEnum(ContractStatus)
  contractStatus?: ContractStatus;

  @ApiPropertyOptional({
    example: '2026-05',
    description: 'Theo dõi công nợ — từ tháng',
  })
  @IsOptional()
  @Matches(PERIOD_PATTERN)
  receivablesFromPeriod?: string;

  @ApiPropertyOptional({
    example: '2026-10',
    description: 'Theo dõi công nợ — đến tháng',
  })
  @IsOptional()
  @Matches(PERIOD_PATTERN)
  receivablesToPeriod?: string;
}
