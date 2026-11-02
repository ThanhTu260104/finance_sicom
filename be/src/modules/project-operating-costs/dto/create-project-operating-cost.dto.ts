import {
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PERIOD_REGEX } from '../../../common/constants/period';

export class CreateProjectOperatingCostDto {
  @ApiProperty({ example: '2026-09' })
  @IsString()
  @Matches(PERIOD_REGEX, { message: 'period must be YYYY-MM' })
  period: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({
    example: 'OPERATING',
    description: 'Mã loại chi phí (nếu không gửi categoryId)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  categoryCode?: string;

  @ApiPropertyOptional({ example: 'Phát sinh sửa chữa' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @ApiProperty({ example: 1500000 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amount: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}
