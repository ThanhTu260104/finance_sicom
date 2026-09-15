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
import { RevenuePlansService } from './revenue-plans.service';
import { CreateRevenuePlanDto } from './dto/create-revenue-plan.dto';
import { UpdateRevenuePlanDto } from './dto/update-revenue-plan.dto';

@ApiTags('revenue-plans')
@Controller()
export class RevenuePlansController {
  constructor(private readonly revenuePlansService: RevenuePlansService) {}

  @Get('contracts/:contractId/revenue-plans')
  @ApiOperation({
    summary: 'List revenue plans with plan vs actual comparison',
  })
  findByContract(@Param('contractId', ParseUUIDPipe) contractId: string) {
    return this.revenuePlansService.findByContract(contractId);
  }

  @Post('contracts/:contractId/revenue-plans')
  @ApiOperation({ summary: 'Create revenue plan for a contract period' })
  create(
    @Param('contractId', ParseUUIDPipe) contractId: string,
    @Body() dto: CreateRevenuePlanDto,
  ) {
    return this.revenuePlansService.create(contractId, dto);
  }

  @Patch('revenue-plans/:id')
  @ApiOperation({ summary: 'Update revenue plan' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRevenuePlanDto,
  ) {
    return this.revenuePlansService.update(id, dto);
  }

  @Delete('revenue-plans/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete revenue plan' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.revenuePlansService.remove(id);
  }
}
