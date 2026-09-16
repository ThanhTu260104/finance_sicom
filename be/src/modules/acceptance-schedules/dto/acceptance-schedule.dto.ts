import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AcceptanceScheduleMethod } from '@prisma/client';
import { PERIOD_REGEX } from '../../../common/constants/period';

export class CreateAcceptanceScheduleDto {
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  sequence: number;

  @IsString()
  @MinLength(1)
  @MaxLength(150)
  name: string;

  @IsOptional()
  @IsString()
  @Matches(PERIOD_REGEX)
  startPeriod?: string;

  @IsOptional()
  @IsString()
  @Matches(PERIOD_REGEX)
  endPeriod?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsEnum(AcceptanceScheduleMethod)
  method: AcceptanceScheduleMethod;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  plannedAmount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  percentOfContract?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  plannedQuantity?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  actualQuantity?: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  unit?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}
