import { PartialType } from '@nestjs/swagger';
import { CreateProjectOperatingCostDto } from './create-project-operating-cost.dto';

export class UpdateProjectOperatingCostDto extends PartialType(
  CreateProjectOperatingCostDto,
) {}
