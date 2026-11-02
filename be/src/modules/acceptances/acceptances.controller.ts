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
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { AcceptancesService } from './acceptances.service';
import { CreateAcceptanceDto } from './dto/create-acceptance.dto';
import { UpdateAcceptanceDto } from './dto/update-acceptance.dto';
import { BulkAcceptanceDto } from './dto/bulk-acceptance.dto';
import { AccountingImportDto } from './dto/accounting-import.dto';

@ApiTags('acceptances')
@Controller()
export class AcceptancesController {
  constructor(private readonly acceptancesService: AcceptancesService) {}

  @Get('contracts/:contractId/acceptances')
  @ApiOperation({ summary: 'List acceptances for a contract' })
  findByContract(@Param('contractId', ParseUUIDPipe) contractId: string) {
    return this.acceptancesService.findByContract(contractId);
  }

  @Get('acceptances/:id')
  @ApiOperation({ summary: 'Get acceptance by id' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.acceptancesService.findOne(id);
  }

  @Post('contracts/:contractId/acceptances')
  @ApiOperation({ summary: 'Create acceptance for a contract' })
  create(
    @Param('contractId', ParseUUIDPipe) contractId: string,
    @Body() dto: CreateAcceptanceDto,
  ) {
    return this.acceptancesService.create(contractId, dto);
  }

  @Post('contracts/:contractId/acceptances/bulk')
  @ApiOperation({ summary: 'Bulk upsert acceptances for a contract' })
  bulkUpsert(
    @Param('contractId', ParseUUIDPipe) contractId: string,
    @Body() dto: BulkAcceptanceDto,
  ) {
    return this.acceptancesService.bulkUpsert(contractId, dto);
  }

  @Post('acceptances/import-accounting')
  // Import file kế toán (nhiều HĐ cùng lúc) — chỉ quản trị
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Import nghiệm thu từ bảng kế toán (nhiều hợp đồng)',
  })
  importAccounting(@Body() dto: AccountingImportDto) {
    return this.acceptancesService.importAccounting(dto);
  }

  @Patch('acceptances/:id')
  @ApiOperation({ summary: 'Update acceptance' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAcceptanceDto,
  ) {
    return this.acceptancesService.update(id, dto);
  }

  @Delete('acceptances/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Soft delete acceptance' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.acceptancesService.remove(id);
  }
}
