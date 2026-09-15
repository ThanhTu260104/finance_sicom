import { PartialType } from '@nestjs/swagger';
import { CreateProjectAssignmentDto } from './create-project-assignment.dto';

export class UpdateProjectAssignmentDto extends PartialType(
  CreateProjectAssignmentDto,
) {}
