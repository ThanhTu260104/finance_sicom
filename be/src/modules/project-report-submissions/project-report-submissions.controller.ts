import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
  Res,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import type { Request } from 'express';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { memoryStorage } from 'multer';
import { plainToInstance } from 'class-transformer';
import { validateOrReject } from 'class-validator';
import { MAX_UPLOAD_FILE_SIZE } from '../../common/constants/upload.constants';
import { Public } from '../../common/decorators/public.decorator';
import { contentDispositionAttachment } from '../../common/utils/filename-encoding.util';
import { CreateProjectReportSubmissionDto } from './dto/create-project-report-submission.dto';
import { InitProjectReportStagedFileDto } from './dto/init-project-report-staged-file.dto';
import { SubmitProjectReportSubmissionDto } from './dto/submit-project-report-submission.dto';
import { ProjectReportSubmissionsService } from './project-report-submissions.service';

@ApiTags('project-report-submissions')
@Controller()
export class ProjectReportSubmissionsController {
  constructor(
    private readonly service: ProjectReportSubmissionsService,
  ) {}

  @Public()
  @Get('public/report-form/projects')
  @ApiOperation({
    summary: 'Danh sách dự án cho form nộp báo cáo công khai (không đăng nhập)',
  })
  publicFormProjects() {
    return this.service.listProjectsForPublicForm();
  }

  @Public()
  @Get('projects/:projectId/report-submission-prefill')
  @ApiOperation({
    summary:
      'Mẫu nộp báo cáo: HĐ của dự án + KH NT hệ thống (chỉ đọc, tham chiếu)',
  })
  prefill(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query('period') period: string,
  ) {
    return this.service.getPrefill(projectId, period);
  }

  @Get('project-report-submissions/period-summary')
  @ApiOperation({ summary: 'Tổng hợp nộp báo cáo theo tháng (đã nộp / chưa nộp)' })
  periodSummary(@Query('period') period: string) {
    return this.service.getPeriodSummary(period);
  }

  @Get('project-report-submissions')
  @ApiOperation({ summary: 'Danh sách báo cáo đã nộp' })
  list(
    @Query('projectId') projectId?: string,
    @Query('period') period?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.list({
      projectId: projectId || undefined,
      period: period || undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('project-report-submissions/:id')
  @ApiOperation({ summary: 'Chi tiết một lần nộp báo cáo' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Delete('project-report-submissions/:id')
  @ApiOperation({ summary: 'Xóa mềm báo cáo đã nộp (cần đăng nhập)' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }

  @Public()
  @Post('project-report-staged-files/init')
  @ApiOperation({
    summary:
      'Tạo phiên upload — client PUT file lên uploadUrl (stream, có progress)',
  })
  initStagedUpload(@Body() dto: InitProjectReportStagedFileDto) {
    return this.service.initStagedUpload(dto);
  }

  @Public()
  @Put('project-report-staged-files/:id/content')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Upload nội dung file (PUT binary, không qua multipart Nest)',
  })
  uploadStagedContent(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
    @Headers('content-length') contentLength?: string,
  ) {
    return this.service.uploadStagedContent(id, req, contentLength);
  }

  @Public()
  @Post('project-report-staged-files/:id/complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Xác nhận upload R2 xong (sau PUT presigned từ browser)',
  })
  completeStagedUpload(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.completeStagedUpload(id);
  }

  @Public()
  @Post('project-report-submissions/submit')
  @ApiOperation({
    summary:
      'Nộp báo cáo JSON + fileIds (sau khi upload staged) — nhanh, không multipart',
  })
  submitWithStagedFiles(@Body() dto: SubmitProjectReportSubmissionDto) {
    return this.service.createWithStagedFiles(dto);
  }

  @Public()
  @Post('project-report-submissions')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary:
      'Nộp báo cáo (lưu riêng — không cập nhật kế hoạch NT hệ thống)',
  })
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      storage: memoryStorage(),
      limits: { fileSize: MAX_UPLOAD_FILE_SIZE },
    }),
  )
  async create(
    @Body('payload') payloadJson: string,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(payloadJson);
    } catch {
      parsed = null;
    }
    const dto = plainToInstance(CreateProjectReportSubmissionDto, parsed);
    await validateOrReject(dto);
    return this.service.create(dto, files ?? []);
  }

  @Get('project-report-submission-files/:id/download')
  @ApiOperation({ summary: 'Tải file báo cáo đã nộp' })
  async download(
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    const { stream, fileName, mimeType } =
      await this.service.getDownloadStream(id);
    res.setHeader('Content-Type', mimeType);
    res.setHeader(
      'Content-Disposition',
      contentDispositionAttachment(fileName),
    );
    stream.pipe(res);
  }
}
