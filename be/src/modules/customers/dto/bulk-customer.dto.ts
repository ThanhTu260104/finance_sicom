import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CustomerStatus, PartnerType } from '@prisma/client';

function emptyToUndefined({ value }: { value: unknown }) {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'string' && value.trim() === '') return undefined;
  return typeof value === 'string' ? value.trim() : value;
}

export class BulkCustomerItemDto {
  @ApiProperty({ example: 'BV175' })
  @Transform(emptyToUndefined)
  @IsString({ message: 'Mã KH phải là chuỗi' })
  @MinLength(1, { message: 'Thiếu mã khách hàng' })
  @MaxLength(50, { message: 'Mã KH tối đa 50 ký tự' })
  code: string;

  @ApiProperty({ example: 'Bệnh viện Quân Y 175' })
  @Transform(emptyToUndefined)
  @IsString({ message: 'Tên KH phải là chuỗi' })
  @MinLength(1, { message: 'Thiếu tên khách hàng' })
  @MaxLength(255, { message: 'Tên KH tối đa 255 ký tự' })
  name: string;

  @ApiPropertyOptional()
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(50, { message: 'MST tối đa 50 ký tự' })
  taxCode?: string;

  @ApiPropertyOptional()
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional()
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  contactName?: string;

  @ApiPropertyOptional()
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(30, { message: 'SĐT tối đa 30 ký tự' })
  contactPhone?: string;

  @ApiPropertyOptional()
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsEmail({}, { message: 'Email không hợp lệ' })
  contactEmail?: string;

  @ApiPropertyOptional({ enum: CustomerStatus })
  @IsOptional()
  @IsEnum(CustomerStatus, {
    message: 'Trạng thái phải là ACTIVE hoặc INACTIVE',
  })
  status?: CustomerStatus;

  @ApiPropertyOptional({
    enum: PartnerType,
    isArray: true,
    description: 'Gộp thêm vào loại đối tác hiện có (không xóa loại cũ)',
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1, { message: 'Chọn ít nhất một loại đối tác' })
  @IsEnum(PartnerType, {
    each: true,
    message: 'Loại đối tác: INVESTOR | SUBCONTRACTOR | SUPPLIER',
  })
  partnerTypes?: PartnerType[];

  @ApiPropertyOptional()
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  note?: string;
}

export class BulkCustomerDto {
  @ApiProperty({ type: [BulkCustomerItemDto] })
  @IsArray({ message: 'Dữ liệu nhập phải là danh sách' })
  @ArrayMinSize(1, { message: 'Cần ít nhất 1 dòng khách hàng' })
  @ValidateNested({ each: true })
  @Type(() => BulkCustomerItemDto)
  items: BulkCustomerItemDto[];
}
