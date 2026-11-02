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
import { MAX_UPLOAD_FILE_SIZE } from '../../common/constants/upload.constants';
import { contentDispositionAttachment } from '../../common/utils/filename-encoding.util';
import { AcceptanceAttachmentsService } from './acceptance-attachments.service';
import { UploadAcceptanceAttachmentDto } from './dto/upload-acceptance-attachment.dto';

@ApiTags('acceptance-attachments')
@Controller()
export class AcceptanceAttachmentsController {
  constructor(
    private readonly acceptanceAttachmentsService: AcceptanceAttachmentsService,
  ) {}

  @Get('acceptances/:acceptanceId/attachments')
  @ApiOperation({ summary: 'List attachments for an acceptance' })
  findByAcceptance(@Param('acceptanceId', ParseUUIDPipe) acceptanceId: string) {
    return this.acceptanceAttachmentsService.findByAcceptance(acceptanceId);
  }

  @Post('acceptances/:acceptanceId/attachments')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload attachment for an acceptance' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_UPLOAD_FILE_SIZE },
    }),
  )
  upload(
    @Param('acceptanceId', ParseUUIDPipe) acceptanceId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadAcceptanceAttachmentDto,
  ) {
    return this.acceptanceAttachmentsService.upload(acceptanceId, file, dto);
  }

  @Get('acceptance-attachments/:id/download')
  @ApiOperation({ summary: 'Download acceptance attachment file' })
  async download(@Param('id', ParseUUIDPipe) id: string, @Res() res: Response) {
    const { stream, fileName, mimeType } =
      await this.acceptanceAttachmentsService.getDownloadStream(id);
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', contentDispositionAttachment(fileName));
    stream.pipe(res);
  }

  @Delete('acceptance-attachments/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Soft delete acceptance attachment' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.acceptanceAttachmentsService.remove(id);
  }
}
