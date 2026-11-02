import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ProjectOperatingCostsService } from './project-operating-costs.service';
import { CreateProjectOperatingCostDto } from './dto/create-project-operating-cost.dto';
import { UpdateProjectOperatingCostDto } from './dto/update-project-operating-cost.dto';
import { BulkProjectOperatingCostDto } from './dto/bulk-project-operating-cost.dto';
import { QueryProjectOperatingCostDto } from './dto/query-project-operating-cost.dto';
import { OperatingCostTrendQueryDto } from './dto/operating-cost-trend-query.dto';

@ApiTags('project-operating-costs')
@Controller()
export class ProjectOperatingCostsController {
  constructor(
    private readonly projectOperatingCostsService: ProjectOperatingCostsService,
  ) {}

  @Get('projects/:projectId/operating-costs')
  @ApiOperation({
    summary:
      'List operating cost lines (period, or fromPeriod/toPeriod/year for range)',
  })
  findByProject(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query() query: QueryProjectOperatingCostDto,
  ) {
    return this.projectOperatingCostsService.findByProject(projectId, query);
  }

  @Get('projects/:projectId/operating-costs/trend')
  @ApiOperation({
    summary:
      'Monthly totals by period (YYYY-MM) for charts — filter by year or from/to',
  })
  projectTrend(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query() query: OperatingCostTrendQueryDto,
  ) {
    return this.projectOperatingCostsService.getMonthlyTrend({
      ...query,
      projectId,
    });
  }

  @Get('projects/:projectId/contract-costs')
  @ApiOperation({
    summary:
      'Chi phí thầu phụ / nhà cung cấp theo kỳ (tổng chi trả trên HĐ chi của dự án)',
  })
  contractCosts(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query() query: OperatingCostTrendQueryDto,
  ) {
    return this.projectOperatingCostsService.getContractCosts(projectId, query);
  }

  @Get('projects/:projectId/operating-costs/periods')
  @ApiOperation({ summary: 'List distinct cost periods for project' })
  listPeriods(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.projectOperatingCostsService.listPeriods(projectId);
  }

  @Post('projects/:projectId/operating-costs')
  @ApiOperation({ summary: 'Add operating cost line' })
  create(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: CreateProjectOperatingCostDto,
  ) {
    return this.projectOperatingCostsService.create(projectId, dto);
  }

  @Post('projects/:projectId/operating-costs/bulk')
  @ApiOperation({ summary: 'Bulk add operating cost lines' })
  bulkCreate(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: BulkProjectOperatingCostDto,
  ) {
    return this.projectOperatingCostsService.bulkCreate(projectId, dto);
  }

  @Patch('project-operating-costs/:id')
  @ApiOperation({ summary: 'Update operating cost line' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProjectOperatingCostDto,
  ) {
    return this.projectOperatingCostsService.update(id, dto);
  }

  @Delete('project-operating-costs/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete operating cost line' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.projectOperatingCostsService.remove(id);
  }
}
