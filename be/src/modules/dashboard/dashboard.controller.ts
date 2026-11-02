import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { DashboardLegacyService } from './dashboard-legacy.service';
import { DashboardService } from './dashboard.service';
import { DashboardOverviewQueryDto } from './dto/dashboard-overview-query.dto';
import { DashboardTimelineQueryDto } from './dto/dashboard-timeline-query.dto';
import { DashboardTrendPeriodQueryDto } from './dto/dashboard-trend-period-query.dto';
import { ProjectOperatingCostsService } from '../project-operating-costs/project-operating-costs.service';
import { OperatingCostTrendQueryDto } from '../project-operating-costs/dto/operating-cost-trend-query.dto';

const DASHBOARD_DOC =
  'Dashboard chỉ dùng kế hoạch nghiệm thu (RevenuePlan) và thu tiền thực tế (Collection). Không có kế hoạch thu tiền.';

@ApiTags('dashboard')
@Controller('dashboard')
export class DashboardController {
  constructor(
    private readonly dashboardService: DashboardService,
    private readonly legacyService: DashboardLegacyService,
    private readonly projectOperatingCostsService: ProjectOperatingCostsService,
  ) {}

  @Get('overview')
  @ApiOperation({
    summary: 'Dashboard tổng quan (KPI + cumulative trend)',
    description: DASHBOARD_DOC,
  })
  getOverview(@Query() query: DashboardOverviewQueryDto) {
    return this.dashboardService.getOverview(query);
  }

  @Get('trend-by-project')
  @ApiOperation({
    summary: 'Chi tiết nghiệm thu · thu tiền theo dự án trong một tháng',
    description: DASHBOARD_DOC,
  })
  getTrendByProject(@Query() query: DashboardTrendPeriodQueryDto) {
    return this.dashboardService.getTrendPeriodByProject(query);
  }

  @Get('receivables-monitor')
  @ApiOperation({
    summary: 'Theo dõi công nợ theo hợp đồng và tháng',
    description: DASHBOARD_DOC,
  })
  getReceivablesMonitor(@Query() query: DashboardOverviewQueryDto) {
    return this.dashboardService.getReceivablesMonitor(query);
  }

  @Get('timeline')
  @ApiOperation({
    summary: 'Timeline hợp đồng (phân trang)',
    description: DASHBOARD_DOC,
  })
  getTimeline(@Query() query: DashboardTimelineQueryDto) {
    return this.dashboardService.getTimeline(query);
  }

  @Get('operating-costs-trend')
  @ApiOperation({
    summary:
      'Chi phí vận hành dự án theo tháng (YYYY-MM), tổng hợp cho biểu đồ',
  })
  getOperatingCostsTrend(@Query() query: OperatingCostTrendQueryDto) {
    return this.projectOperatingCostsService.getMonthlyTrend(query);
  }

  @Get('overview-legacy')
  @ApiOperation({
    summary: 'Response dashboard cũ (tương thích FE hiện tại đến Phase B)',
    deprecated: true,
  })
  getOverviewLegacy() {
    return this.legacyService.getOverview();
  }
}

@ApiTags('dashboard')
@Controller('projects')
export class ProjectDashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get(':projectId/dashboard')
  @ApiOperation({
    summary:
      'Dashboard theo dự án (batch aggregate, không N+1 financial-control)',
    description: DASHBOARD_DOC,
  })
  getProjectDashboard(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query() query: DashboardOverviewQueryDto,
  ) {
    return this.dashboardService.getProjectDashboard(projectId, query);
  }
}

@ApiTags('dashboard')
@Controller('contracts')
export class ContractDashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get(':contractId/dashboard')
  @ApiOperation({
    summary: 'Dashboard theo hợp đồng (KPI + monthly rows)',
    description: DASHBOARD_DOC,
  })
  getContractDashboard(@Param('contractId', ParseUUIDPipe) contractId: string) {
    return this.dashboardService.getContractDashboard(contractId);
  }
}
