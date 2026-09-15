import { Module } from '@nestjs/common';
import { RevenuePlansModule } from '../revenue-plans/revenue-plans.module';
import { FinancialControlController } from './financial-control.controller';
import { FinancialControlService } from './financial-control.service';
import { MonthlyFinancialsService } from './monthly-financials.service';

@Module({
  imports: [RevenuePlansModule],
  controllers: [FinancialControlController],
  providers: [FinancialControlService, MonthlyFinancialsService],
  exports: [FinancialControlService, MonthlyFinancialsService],
})
export class FinancialControlModule {}
