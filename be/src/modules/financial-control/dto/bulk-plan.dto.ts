import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
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
  @ApiProperty({ example: '2026-02' })
  @IsString()
  @Matches(PERIOD_REGEX)
  period: string;

  @ApiProperty({ example: 1000000000 })
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

export class BulkPlanDto {
  @ApiPropertyOptional({
    description: 'Generate periods from contract startDate/endDate',
  })
  @IsOptional()
  @IsBoolean()
  generateFromContractDates?: boolean;

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
