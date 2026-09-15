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
import { CollectionsService } from './collections.service';
import { CreateCollectionDto } from './dto/create-collection.dto';
import { UpdateCollectionDto } from './dto/update-collection.dto';
import { BulkCollectionDto } from './dto/bulk-collection.dto';

@ApiTags('collections')
@Controller()
export class CollectionsController {
  constructor(private readonly collectionsService: CollectionsService) {}

  @Get('contracts/:contractId/collections')
  @ApiOperation({ summary: 'List collections for a contract' })
  findByContract(@Param('contractId', ParseUUIDPipe) contractId: string) {
    return this.collectionsService.findByContract(contractId);
  }

  @Post('contracts/:contractId/collections')
  @ApiOperation({ summary: 'Create collection for a contract' })
  create(
    @Param('contractId', ParseUUIDPipe) contractId: string,
    @Body() dto: CreateCollectionDto,
  ) {
    return this.collectionsService.create(contractId, dto);
  }

  @Post('contracts/:contractId/collections/bulk')
  @ApiOperation({ summary: 'Bulk upsert collections for a contract' })
  bulkUpsert(
    @Param('contractId', ParseUUIDPipe) contractId: string,
    @Body() dto: BulkCollectionDto,
  ) {
    return this.collectionsService.bulkUpsert(contractId, dto);
  }

  @Patch('collections/:id')
  @ApiOperation({ summary: 'Update collection' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCollectionDto,
  ) {
    return this.collectionsService.update(id, dto);
  }

  @Delete('collections/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Soft delete collection' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.collectionsService.remove(id);
  }
}
