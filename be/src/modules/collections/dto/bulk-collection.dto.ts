import {
  ArrayMinSize,
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { PERIOD_REGEX } from '../../../common/constants/period';

export class BulkCollectionItemDto {
  @ApiProperty({ example: 'TT-02/2026' })
  @IsString()
  @MaxLength(100)
  collectionNo: string;

  @ApiProperty({ example: '2026-02' })
  @IsString()
  @Matches(PERIOD_REGEX, { message: 'period must be in YYYY-MM format' })
  period: string;

  @ApiProperty({ example: 700000000 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amount: number;

  @ApiPropertyOptional({ example: '2026-02-28' })
  @IsOptional()
  @IsString()
  collectionDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}

export class BulkCollectionDto {
  @ApiProperty({ type: [BulkCollectionItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BulkCollectionItemDto)
  items: BulkCollectionItemDto[];
}
