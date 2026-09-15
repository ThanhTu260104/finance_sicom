import { PartialType } from '@nestjs/swagger';
import { CreateRevenuePlanDto } from './create-revenue-plan.dto';

export class UpdateRevenuePlanDto extends PartialType(CreateRevenuePlanDto) {}
