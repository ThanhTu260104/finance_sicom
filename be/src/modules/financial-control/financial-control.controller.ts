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
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { FinancialControlService } from './financial-control.service';
import { MonthlyFinancialsService } from './monthly-financials.service';
import { CreateMonthlyFinancialDto } from './dto/create-monthly-financial.dto';
import { UpdateMonthlyFinancialDto } from './dto/update-monthly-financial.dto';
import {
  BulkPlanDto,
  DraftEqualSplitDto,
  GeneratePeriodsDto,
} from './dto/bulk-plan.dto';

@ApiTags('financial-control')
@Controller()
export class FinancialControlController {
  constructor(
    private readonly financialControlService: FinancialControlService,
    private readonly monthlyFinancialsService: MonthlyFinancialsService,
  ) {}

  @Get('contracts/:contractId/financial-control')
  @ApiOperation({
    summary: 'Get contract financial control summary and monthly rows',
  })
  getFinancialControl(@Param('contractId', ParseUUIDPipe) contractId: string) {
    return this.financialControlService.getFinancialControl(contractId);
  }

  @Post('contracts/:contractId/financial-control/generate-periods')
  @ApiOperation({ summary: 'Generate monthly periods for a contract' })
  generatePeriods(
    @Param('contractId', ParseUUIDPipe) contractId: string,
    @Body() dto: GeneratePeriodsDto,
  ) {
    return this.financialControlService.generatePeriods(contractId, dto);
  }

  @Post('contracts/:contractId/financial-control/draft-equal-split')
  @ApiOperation({
    summary: 'Draft equal-split plan amounts (user must confirm before save)',
  })
  draftEqualSplit(
    @Param('contractId', ParseUUIDPipe) contractId: string,
    @Body() dto: DraftEqualSplitDto,
  ) {
    return this.financialControlService.draftEqualSplit(contractId, dto);
  }

  @Post('contracts/:contractId/financial-control/bulk-plans')
  @ApiOperation({ summary: 'Bulk create or update revenue plans' })
  bulkUpsertPlans(
    @Param('contractId', ParseUUIDPipe) contractId: string,
    @Body() dto: BulkPlanDto,
  ) {
    return this.financialControlService.bulkUpsertPlans(contractId, dto);
  }

  @Get('contracts/:contractId/monthly-financials')
  @ApiOperation({ summary: 'List monthly financial records (actual work)' })
  findMonthlyFinancials(
    @Param('contractId', ParseUUIDPipe) contractId: string,
  ) {
    return this.monthlyFinancialsService.findByContract(contractId);
  }

  @Post('contracts/:contractId/monthly-financials')
  @ApiOperation({ summary: 'Create monthly financial record' })
  createMonthlyFinancial(
    @Param('contractId', ParseUUIDPipe) contractId: string,
    @Body() dto: CreateMonthlyFinancialDto,
  ) {
    return this.monthlyFinancialsService.create(contractId, dto);
  }

  @Patch('monthly-financials/:id')
  @ApiOperation({ summary: 'Update monthly financial record' })
  updateMonthlyFinancial(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMonthlyFinancialDto,
  ) {
    return this.monthlyFinancialsService.update(id, dto);
  }

  @Delete('monthly-financials/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete monthly financial record' })
  removeMonthlyFinancial(@Param('id', ParseUUIDPipe) id: string) {
    return this.monthlyFinancialsService.remove(id);
  }
}
