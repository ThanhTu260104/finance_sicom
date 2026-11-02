import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EmployeeStatus } from '@prisma/client';

function emptyToUndefined({ value }: { value: unknown }) {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'string' && value.trim() === '') return undefined;
  return typeof value === 'string' ? value.trim() : value;
}

export class BulkEmployeeItemDto {
  @ApiProperty({ example: 'NV001' })
  @Transform(emptyToUndefined)
  @IsString({ message: 'Mã NV phải là chuỗi' })
  @MinLength(1, { message: 'Thiếu mã nhân viên' })
  @MaxLength(50, { message: 'Mã NV tối đa 50 ký tự' })
  code: string;

  @ApiProperty({ example: 'Nguyễn Văn A' })
  @Transform(emptyToUndefined)
  @IsString({ message: 'Họ tên phải là chuỗi' })
  @MinLength(1, { message: 'Thiếu họ tên' })
  @MaxLength(255, { message: 'Họ tên tối đa 255 ký tự' })
  fullName: string;

  @ApiPropertyOptional()
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  jobTitle?: string;

  @ApiPropertyOptional({ enum: EmployeeStatus })
  @IsOptional()
  @IsEnum(EmployeeStatus, {
    message: 'Trạng thái phải là ACTIVE hoặc INACTIVE',
  })
  status?: EmployeeStatus;

  @ApiPropertyOptional()
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  note?: string;
}

export class BulkEmployeeDto {
  @ApiProperty({ type: [BulkEmployeeItemDto] })
  @IsArray({ message: 'Dữ liệu nhập phải là danh sách' })
  @ArrayMinSize(1, { message: 'Cần ít nhất 1 dòng nhân viên' })
  @ValidateNested({ each: true })
  @Type(() => BulkEmployeeItemDto)
  items: BulkEmployeeItemDto[];
}
