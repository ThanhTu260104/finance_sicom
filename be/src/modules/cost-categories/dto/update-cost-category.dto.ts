import { PartialType } from '@nestjs/swagger';
import { CreateCostCategoryDto } from './create-cost-category.dto';

export class UpdateCostCategoryDto extends PartialType(CreateCostCategoryDto) {}
