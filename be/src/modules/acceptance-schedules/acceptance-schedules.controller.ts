import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AcceptanceSchedulesService } from './acceptance-schedules.service';
import { CreateAcceptanceScheduleDto } from './dto/acceptance-schedule.dto';
import { UpdateAcceptanceScheduleDto } from './dto/update-acceptance-schedule.dto';

@ApiTags('acceptance-schedules')
@Controller()
export class AcceptanceSchedulesController {
  constructor(private readonly service: AcceptanceSchedulesService) {}

  @Get('contracts/:contractId/acceptance-schedules')
  list(@Param('contractId', ParseUUIDPipe) contractId: string) { return this.service.list(contractId); }

  @Post('contracts/:contractId/acceptance-schedules')
  create(@Param('contractId', ParseUUIDPipe) contractId: string, @Body() dto: CreateAcceptanceScheduleDto) { return this.service.create(contractId, dto); }

  @Patch('acceptance-schedules/:id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateAcceptanceScheduleDto) { return this.service.update(id, dto); }

  @Delete('acceptance-schedules/:id')
  remove(@Param('id', ParseUUIDPipe) id: string) { return this.service.remove(id); }
}
