import { Injectable } from '@nestjs/common';
import { DashboardAggregationService } from './dashboard-aggregation.service';
import { DashboardOverviewQueryDto } from './dto/dashboard-overview-query.dto';
import { DashboardTimelineQueryDto } from './dto/dashboard-timeline-query.dto';
import { DashboardTrendPeriodQueryDto } from './dto/dashboard-trend-period-query.dto';

@Injectable()
export class DashboardService {
  constructor(private readonly aggregation: DashboardAggregationService) {}

  getOverview(query: DashboardOverviewQueryDto) {
    return this.aggregation.getOverview(query);
  }

  getTimeline(query: DashboardTimelineQueryDto) {
    return this.aggregation.getTimeline(query);
  }

  getProjectDashboard(projectId: string, query: DashboardOverviewQueryDto) {
    return this.aggregation.getProjectDashboard(projectId, query);
  }

  getContractDashboard(contractId: string) {
    return this.aggregation.getContractDashboard(contractId);
  }

  getTrendPeriodByProject(query: DashboardTrendPeriodQueryDto) {
    return this.aggregation.getTrendPeriodByProject(query);
  }

  getReceivablesMonitor(query: DashboardOverviewQueryDto) {
    return this.aggregation.getReceivablesMonitor(query);
  }
}
