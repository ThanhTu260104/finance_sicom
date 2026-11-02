import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, ValidateNested } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { CreateCostCategoryDto } from './create-cost-category.dto';

export class BulkCostCategoryDto {
  @ApiProperty({ type: [CreateCostCategoryDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateCostCategoryDto)
  items: CreateCostCategoryDto[];
}
