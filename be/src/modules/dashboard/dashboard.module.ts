import { Module } from '@nestjs/common';
import { ProjectOperatingCostsModule } from '../project-operating-costs/project-operating-costs.module';
import {
  ContractDashboardController,
  DashboardController,
  ProjectDashboardController,
} from './dashboard.controller';
import { DashboardAggregationService } from './dashboard-aggregation.service';
import { DashboardLegacyService } from './dashboard-legacy.service';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [ProjectOperatingCostsModule],
  controllers: [
    DashboardController,
    ProjectDashboardController,
    ContractDashboardController,
  ],
  providers: [
    DashboardService,
    DashboardAggregationService,
    DashboardLegacyService,
  ],
  exports: [DashboardService, DashboardAggregationService],
})
export class DashboardModule {}
