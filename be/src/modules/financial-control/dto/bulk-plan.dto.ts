import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { PERIOD_REGEX } from '../../../common/constants/period';

class BulkPlanItemDto {
  @ApiPropertyOptional({ example: '2026-02' })
  @IsOptional()
  @IsString()
  @Matches(PERIOD_REGEX)
  period?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  batchSequence?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  periodStartDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  periodEndDate?: string;

  @ApiProperty({ example: 1000000000 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  plannedAmount: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  plannedAcceptanceDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}

export class BulkPlanDto {
  @ApiPropertyOptional({
    description: 'Generate periods from contract startDate/endDate',
  })
  @IsOptional()
  @IsBoolean()
  generateFromContractDates?: boolean;

  @ApiPropertyOptional({
    description:
      'Generate periods from durationYears × billingCycle (dashboard NT rounds)',
  })
  @IsOptional()
  @IsBoolean()
  generateFromAcceptanceSchedule?: boolean;

  @ApiPropertyOptional({
    description: 'Delete all existing revenue plans on this contract before upsert',
  })
  @IsOptional()
  @IsBoolean()
  replaceExisting?: boolean;

  @ApiPropertyOptional({
    description: 'Set first period planned amount to 0 when generating',
  })
  @IsOptional()
  @IsBoolean()
  firstPeriodZero?: boolean;

  @ApiPropertyOptional({
    description: 'Evenly split contract value across generated periods',
  })
  @IsOptional()
  @IsBoolean()
  equalSplit?: boolean;

  @ApiPropertyOptional({
    example: '2026-11',
    description: 'Kỳ bắt đầu NT (sinh kế hoạch theo chu kỳ)',
  })
  @IsOptional()
  @IsString()
  @Matches(PERIOD_REGEX)
  startPeriod?: string;

  @ApiPropertyOptional({
    example: '2027-10',
    description: 'Kỳ kết thúc NT (sinh kế hoạch theo chu kỳ)',
  })
  @IsOptional()
  @IsString()
  @Matches(PERIOD_REGEX)
  endPeriod?: string;

  @ApiPropertyOptional({ type: [BulkPlanItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkPlanItemDto)
  items?: BulkPlanItemDto[];
}

export class GeneratePeriodsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  useContractDates?: boolean;

  @ApiPropertyOptional({
    description: 'Use durationYears + billingCycle + startDate instead of endDate',
  })
  @IsOptional()
  @IsBoolean()
  useAcceptanceSchedule?: boolean;

  @ApiPropertyOptional({ example: '2026-01' })
  @IsOptional()
  @IsString()
  @Matches(PERIOD_REGEX)
  startPeriod?: string;

  @ApiPropertyOptional({ example: '2026-12' })
  @IsOptional()
  @IsString()
  @Matches(PERIOD_REGEX)
  endPeriod?: string;
}

export class DraftEqualSplitDto {
  @ApiProperty({ type: [String], example: ['2026-01', '2026-02'] })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  @Matches(PERIOD_REGEX, { each: true })
  periods: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  firstPeriodZero?: boolean;
}
