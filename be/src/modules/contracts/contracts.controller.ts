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
import { AllowFeature } from '../../common/decorators/feature.decorator';
import { FEATURES } from '../../common/constants/features';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ContractsService } from './contracts.service';
import { CreateContractDto } from './dto/create-contract.dto';
import { UpdateContractDto } from './dto/update-contract.dto';
import { QueryContractDto } from './dto/query-contract.dto';
import { BulkContractDto } from './dto/bulk-contract.dto';
import { ContractMaintenanceDailyService } from './contract-maintenance-daily.service';
import { BulkMaintenanceDailyDto } from './dto/bulk-maintenance-daily.dto';

@ApiTags('contracts')
@Controller('contracts')
export class ContractsController {
  constructor(
    private readonly contractsService: ContractsService,
    private readonly maintenanceDailyService: ContractMaintenanceDailyService,
  ) {}

  @Post()
  // Form "Thêm hợp đồng" của tài khoản giới hạn cần API này
  @AllowFeature(FEATURES.CONTRACTS_CREATE)
  @ApiOperation({ summary: 'Create contract' })
  create(@Body() dto: CreateContractDto) {
    return this.contractsService.create(dto);
  }

  @Post('bulk')
  @ApiOperation({ summary: 'Bulk upsert contracts by contractNo' })
  bulkUpsert(@Body() dto: BulkContractDto) {
    return this.contractsService.bulkUpsert(dto);
  }

  @Get()
  // Tài khoản giới hạn "Xem danh sách hợp đồng": chỉ danh sách, không chi tiết
  @AllowFeature(FEATURES.CONTRACTS_LIST)
  @ApiOperation({ summary: 'List contracts' })
  findAll(@Query() query: QueryContractDto) {
    return this.contractsService.findAll(query);
  }

  @Get('import-lookup')
  @ApiOperation({ summary: 'Contract numbers for import validation' })
  importLookup() {
    return this.contractsService.importLookup();
  }

  @Get('overview/statistics')
  @ApiOperation({ summary: 'Contract portfolio statistics' })
  overviewStatistics() {
    return this.contractsService.getOverviewStatistics();
  }

  @Get('maintenance-daily')
  @ApiOperation({ summary: 'Maintenance contracts daily grid for a month' })
  maintenanceDailyGrid(@Query('period') period: string) {
    return this.maintenanceDailyService.getGrid(period);
  }

  @Post('maintenance-daily/bulk')
  @ApiOperation({ summary: 'Upsert maintenance daily amounts' })
  maintenanceDailyBulk(@Body() dto: BulkMaintenanceDailyDto) {
    return this.maintenanceDailyService.bulkUpsert(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get contract by id' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.contractsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update contract' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateContractDto,
  ) {
    return this.contractsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Soft delete contract' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.contractsService.remove(id);
  }
}
