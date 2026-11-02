import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class ImportCampaignVoterRowDto {
  @ApiProperty({ description: 'Mã nhân viên (Employee.code)' })
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  employeeCode: string;

  @ApiPropertyOptional({ description: 'Họ tên (phải khớp khi bình chọn)' })
  @IsOptional()
  @IsString()
  @MaxLength(256)
  fullName?: string;

  @ApiPropertyOptional({ description: 'Email (phải khớp khi bình chọn)' })
  @IsOptional()
  @IsString()
  @MaxLength(256)
  email?: string;
}

export class ImportCampaignVotersDto {
  @ApiProperty({ type: [ImportCampaignVoterRowDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5000)
  @ValidateNested({ each: true })
  @Type(() => ImportCampaignVoterRowDto)
  voters: ImportCampaignVoterRowDto[];
}
