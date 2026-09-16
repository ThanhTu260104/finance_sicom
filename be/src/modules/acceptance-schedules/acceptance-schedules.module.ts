import { Module } from '@nestjs/common';
import { AcceptanceSchedulesController } from './acceptance-schedules.controller';
import { AcceptanceSchedulesService } from './acceptance-schedules.service';

@Module({ controllers: [AcceptanceSchedulesController], providers: [AcceptanceSchedulesService] })
export class AcceptanceSchedulesModule {}
