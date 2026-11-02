import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProjectAssignmentRole } from '@prisma/client';

export class CreateProjectAssignmentDto {
  @ApiProperty({ enum: ProjectAssignmentRole })
  @IsEnum(ProjectAssignmentRole)
  role: ProjectAssignmentRole;

  @ApiPropertyOptional({ default: 1, description: 'Số lượng nhân sự theo vai trò' })
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
  @IsOptional()
  @IsString()
  note?: string;
}
