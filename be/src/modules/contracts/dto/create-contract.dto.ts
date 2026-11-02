import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BillingCycle, ContractKind, ContractStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsContractTypes } from '../../../common/validators/is-contract-types.validator';

export class CreateContractDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  projectId: string;

  @ApiPropertyOptional({
    enum: ContractKind,
    default: ContractKind.INVESTOR,
    description: 'INVESTOR = thu tiền CĐT; SUBCONTRACTOR / SUPPLIER = chi tiền',
  })
  @IsOptional()
  @IsEnum(ContractKind)
  kind?: ContractKind;

  @ApiPropertyOptional({ format: 'uuid', description: 'Công ty ký HĐ' })
  @IsOptional()
  @IsUUID()
  companyId?: string | null;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Thầu phụ / nhà cung cấp (bắt buộc với HĐ chi)',
  })
  @IsOptional()
  @IsUUID()
  counterpartyId?: string | null;

  @ApiProperty({ example: '175/2026/HĐDV' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  contractNo: string;

  @ApiProperty({ example: 'Hợp đồng dịch vụ BV Quân Y 175' })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name: string;

  @ApiProperty({
    example: 'OPERATION;MAINTENANCE',
    description: 'Một hoặc nhiều loại, phân cách bằng ";"',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @IsContractTypes()
  contractType: string;

  @ApiProperty({ example: 7500000000 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  contractValue: number;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional()
  @IsDateString()
  signedDate?: string;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiProperty({ enum: BillingCycle })
  @IsEnum(BillingCycle)
  billingCycle: BillingCycle;

  @ApiPropertyOptional({ enum: ContractStatus })
  @IsOptional()
  @IsEnum(ContractStatus)
  status?: ContractStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({
    example: 60,
    description: 'Số ngày thanh toán sau ngày hóa đơn',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  paymentTermDays?: number;

  @ApiPropertyOptional({
    example: 1,
    description: 'Thời hạn hợp đồng (năm), nhập 1, 2, …',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  durationYears?: number;
}
