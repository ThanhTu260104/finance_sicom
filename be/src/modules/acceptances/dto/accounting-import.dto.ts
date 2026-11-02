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
  DocumentStatus,
} from '@prisma/client';
import { Type } from 'class-transformer';
import { PERIOD_REGEX } from '../../../common/constants/period';

export class AccountingImportItemDto {
  @ApiProperty({ example: 'HD2500196163_2511241025' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  contractNo: string;

  @ApiPropertyOptional({ example: 'ĐKCC' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  projectCode?: string;

  @ApiProperty({ example: 'C26TSC1' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  acceptanceNo: string;

  @ApiProperty({ example: '2026-01' })
  @IsString()
  @Matches(PERIOD_REGEX, { message: 'period must be in YYYY-MM format' })
  period: string;

  @ApiProperty({ example: 54189000 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amount: number;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional()
  @IsDateString()
  acceptanceDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  invoiceNo?: string;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional()
  @IsDateString()
  invoiceDate?: string;

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

export class AccountingImportDto {
  @ApiProperty({ type: [AccountingImportItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AccountingImportItemDto)
  items: AccountingImportItemDto[];

  /** Chỉ xử lý các dòng có contractNo khớp (sau chuẩn hóa) */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  onlyContractNo?: string;
}
