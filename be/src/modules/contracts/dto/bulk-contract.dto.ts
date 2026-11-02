import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BillingCycle, ContractKind, ContractStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsContractTypes } from '../../../common/validators/is-contract-types.validator';

export enum DeletedContractConflictAction {
  RESTORE = 'RESTORE',
  REPLACE = 'REPLACE',
}

export class BulkContractItemDto {
  @ApiProperty({
    example: '175',
    description: 'Mã dự án (project.code) — ưu tiên hơn projectId',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  projectCode: string;

  @ApiPropertyOptional({ example: 'SICOM', description: 'Mã công ty ký HĐ' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  companyCode?: string;

  @ApiPropertyOptional({
    example: 'TP001',
    description: 'Mã thầu phụ / nhà cung cấp (bắt buộc với HĐ chi)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  counterpartyCode?: string;

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

  @ApiProperty({ example: 'OPERATION;MAINTENANCE' })
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

  @ApiProperty({ enum: BillingCycle })
  @IsEnum(BillingCycle)
  billingCycle: BillingCycle;

  @ApiPropertyOptional({ enum: ContractStatus })
  @IsOptional()
  @IsEnum(ContractStatus)
  status?: ContractStatus;

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

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;

  @ApiPropertyOptional({ example: 60 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  paymentTermDays?: number;

  @ApiPropertyOptional({ example: 1, description: 'Thời hạn HĐ (năm)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  durationYears?: number;
}

export class BulkContractDto {
  @ApiProperty({ type: [BulkContractItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BulkContractItemDto)
  items: BulkContractItemDto[];

  @ApiPropertyOptional({
    enum: ContractKind,
    default: ContractKind.INVESTOR,
    description: 'Loại HĐ áp cho toàn bộ file (theo tab đang nhập)',
  })
  @IsOptional()
  @IsEnum(ContractKind)
  kind?: ContractKind;

  @ApiPropertyOptional({
    enum: DeletedContractConflictAction,
    description:
      'How to handle an imported contract whose number matches a soft-deleted contract',
  })
  @IsOptional()
  @IsEnum(DeletedContractConflictAction)
  deletedConflictAction?: DeletedContractConflictAction;
}
