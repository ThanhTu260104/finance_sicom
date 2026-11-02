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
import { CostCategoriesService } from './cost-categories.service';
import { CreateCostCategoryDto } from './dto/create-cost-category.dto';
import { UpdateCostCategoryDto } from './dto/update-cost-category.dto';
import { QueryCostCategoryDto } from './dto/query-cost-category.dto';
import { BulkCostCategoryDto } from './dto/bulk-cost-category.dto';

@ApiTags('cost-categories')
@Controller('cost-categories')
export class CostCategoriesController {
  constructor(private readonly costCategoriesService: CostCategoriesService) {}

  @Post()
  create(@Body() dto: CreateCostCategoryDto) {
    return this.costCategoriesService.create(dto);
  }

  @Post('bulk')
  bulkUpsert(@Body() dto: BulkCostCategoryDto) {
    return this.costCategoriesService.bulkUpsert(dto);
  }

  @Get()
  findAll(@Query() query: QueryCostCategoryDto) {
    return this.costCategoriesService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.costCategoriesService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCostCategoryDto,
  ) {
    return this.costCategoriesService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.costCategoriesService.remove(id);
  }
}
