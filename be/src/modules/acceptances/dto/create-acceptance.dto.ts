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
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  AcceptancePaymentStatus,
  AcceptanceStatus,
  DocumentStatus,
} from '@prisma/client';
import { Type } from 'class-transformer';
import { PERIOD_REGEX } from '../../../common/constants/period';

export class CreateAcceptanceDto {
  @ApiProperty({ example: 'Đợt 08/2026', description: 'Đợt nghiệm thu' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  acceptanceNo: string;

  @ApiProperty({ example: '2026-08', description: 'Period as YYYY-MM' })
  @IsString()
  @Matches(PERIOD_REGEX, {
    message: 'period must be in YYYY-MM format',
  })
  period: string;

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

  @ApiProperty({ example: 2000000000 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amount: number;

  @ApiPropertyOptional({ enum: AcceptanceStatus })
  @IsOptional()
  @IsEnum(AcceptanceStatus)
  status?: AcceptanceStatus;

  @ApiPropertyOptional({
    enum: DocumentStatus,
    description: 'Chưa nộp | Đã nộp - tiền chưa về',
  })
  @IsOptional()
  @IsEnum(DocumentStatus)
  documentStatus?: DocumentStatus;

  @ApiPropertyOptional({
    enum: AcceptancePaymentStatus,
    description: 'Chưa nghiệm thu | Chờ CĐT thanh toán | Đã thu',
  })
  @IsOptional()
  @IsEnum(AcceptancePaymentStatus)
  paymentStatus?: AcceptancePaymentStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}
