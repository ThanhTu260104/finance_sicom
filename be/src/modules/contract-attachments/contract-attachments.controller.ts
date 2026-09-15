import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { memoryStorage } from 'multer';
import { ContractAttachmentsService } from './contract-attachments.service';
import { UploadContractAttachmentDto } from './dto/upload-contract-attachment.dto';

@ApiTags('contract-attachments')
@Controller()
export class ContractAttachmentsController {
  constructor(
    private readonly contractAttachmentsService: ContractAttachmentsService,
  ) {}

  @Get('contracts/:contractId/attachments')
  @ApiOperation({ summary: 'List attachments for a contract' })
  findByContract(@Param('contractId', ParseUUIDPipe) contractId: string) {
    return this.contractAttachmentsService.findByContract(contractId);
  }

  @Post('contracts/:contractId/attachments')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload attachment for a contract' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 20 * 1024 * 1024 },
    }),
  )
  upload(
    @Param('contractId', ParseUUIDPipe) contractId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadContractAttachmentDto,
  ) {
    return this.contractAttachmentsService.upload(contractId, file, dto);
  }

  @Get('attachments/:id/download')
  @ApiOperation({ summary: 'Download attachment file' })
  async download(
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    const { stream, fileName, mimeType } =
      await this.contractAttachmentsService.getDownloadStream(id);
    res.setHeader('Content-Type', mimeType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(fileName)}"`,
    );
    stream.pipe(res);
  }

  @Delete('attachments/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Soft delete attachment' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.contractAttachmentsService.remove(id);
  }
}
