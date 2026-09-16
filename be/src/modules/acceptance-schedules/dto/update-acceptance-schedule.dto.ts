import { PartialType } from '@nestjs/swagger';
import { CreateAcceptanceScheduleDto } from './acceptance-schedule.dto';

export class UpdateAcceptanceScheduleDto extends PartialType(CreateAcceptanceScheduleDto) {}
