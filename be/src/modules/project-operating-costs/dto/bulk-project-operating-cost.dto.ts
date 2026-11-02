import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { CreateProjectOperatingCostDto } from './create-project-operating-cost.dto';

export class BulkProjectOperatingCostDto {
  @ApiProperty({ type: [CreateProjectOperatingCostDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateProjectOperatingCostDto)
  items: CreateProjectOperatingCostDto[];
}
