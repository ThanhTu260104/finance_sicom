import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class MaintenanceDailyItemDto {
  @ApiProperty()
  @IsUUID()
  contractId!: string;

  @ApiProperty({ example: '2026-10-09' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  workDate!: string;

  @ApiProperty({ example: 1 })
  @IsNumber()
  amount!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}

export class BulkMaintenanceDailyDto {
  @ApiProperty({ example: '2026-10' })
  @IsString()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/)
  period!: string;

  @ApiProperty({ type: [MaintenanceDailyItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => MaintenanceDailyItemDto)
  items!: MaintenanceDailyItemDto[];
}
