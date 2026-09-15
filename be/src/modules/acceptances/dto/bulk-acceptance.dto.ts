import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  AcceptancePaymentStatus,
  AcceptanceStatus,
  DocumentStatus,
} from '@prisma/client';
import { Type } from 'class-transformer';
import { PERIOD_REGEX } from '../../../common/constants/period';

export class BulkAcceptanceItemDto {
  @ApiProperty({ example: 'Đợt 08/2026' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  acceptanceNo: string;

  @ApiProperty({ example: '2026-08' })
  @IsString()
  @Matches(PERIOD_REGEX, { message: 'period must be in YYYY-MM format' })
  period: string;

  @ApiProperty({ example: 2000000000 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amount: number;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional()
  @IsDateString()
  acceptanceDate?: string;

  @ApiPropertyOptional({ example: 'HD-08/2026' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  invoiceNo?: string;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional()
  @IsDateString()
  invoiceDate?: string;

  @ApiPropertyOptional({ enum: AcceptanceStatus })
  @IsOptional()
  @IsEnum(AcceptanceStatus)
  status?: AcceptanceStatus;

  @ApiPropertyOptional({ enum: DocumentStatus })
  @IsOptional()
  @IsEnum(DocumentStatus)
  documentStatus?: DocumentStatus;

  @ApiPropertyOptional({ enum: AcceptancePaymentStatus })
  @IsOptional()
  @IsEnum(AcceptancePaymentStatus)
  paymentStatus?: AcceptancePaymentStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}

export class BulkAcceptanceDto {
  @ApiProperty({ type: [BulkAcceptanceItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BulkAcceptanceItemDto)
  items: BulkAcceptanceItemDto[];
}
