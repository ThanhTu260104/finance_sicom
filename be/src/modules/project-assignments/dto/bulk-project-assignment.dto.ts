import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProjectAssignmentRole } from '@prisma/client';

function emptyToUndefined({ value }: { value: unknown }) {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'string' && value.trim() === '') return undefined;
  return typeof value === 'string' ? value.trim() : value;
}

export class BulkProjectAssignmentItemDto {
  @ApiProperty({ enum: ProjectAssignmentRole })
  @IsEnum(ProjectAssignmentRole)
  role: ProjectAssignmentRole;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsInt()
  @Min(0)
  quantity?: number;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional()
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  note?: string;
}

export class BulkProjectAssignmentDto {
  @ApiProperty({ type: [BulkProjectAssignmentItemDto] })
  @IsArray()
  @ArrayMinSize(1, { message: 'Cần ít nhất 1 dòng phân công' })
  @ValidateNested({ each: true })
  @Type(() => BulkProjectAssignmentItemDto)
  items: BulkProjectAssignmentItemDto[];
}
