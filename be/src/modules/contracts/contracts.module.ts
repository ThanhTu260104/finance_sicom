import { Module } from '@nestjs/common';
import { ContractsController } from './contracts.controller';
import { ContractsService } from './contracts.service';
import { ContractMaintenanceDailyService } from './contract-maintenance-daily.service';

@Module({
  controllers: [ContractsController],
  providers: [ContractsService, ContractMaintenanceDailyService],
  exports: [ContractsService, ContractMaintenanceDailyService],
})
export class ContractsModule {}
