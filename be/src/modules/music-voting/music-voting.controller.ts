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
  Put,
  Query,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
  UsePipes,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import {
  MUSIC_TRACK_MAX_BYTES,
  musicTrackByIdStorage,
  musicTrackIncomingStorage,
} from './music-track-multer.options';
import { ValidationPipe } from '@nestjs/common';
import { MusicVotingService } from './music-voting.service';
import { CreateMusicTrackDto } from './dto/create-music-track.dto';
import { UpdateMusicTrackDto } from './dto/update-music-track.dto';
import { CreateVotingCampaignDto } from './dto/create-voting-campaign.dto';
import { UpdateVotingCampaignDto } from './dto/update-voting-campaign.dto';
import { AddCampaignTrackDto } from './dto/add-campaign-track.dto';
import { SetCampaignTracksDto } from './dto/set-campaign-tracks.dto';
import { ImportCampaignTracksDto } from './dto/import-campaign-tracks.dto';
import { ImportCampaignVotersDto } from './dto/import-campaign-voters.dto';
import { BulkDeleteMusicTracksDto } from './dto/bulk-delete-music-tracks.dto';
import { InitMusicTrackR2UploadDto } from './dto/init-music-track-r2-upload.dto';
import { InitMusicTrackR2ReuploadDto } from './dto/init-music-track-r2-reupload.dto';

const multipartValidationPipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: false,
  transform: true,
});

@ApiTags('music-voting')
@Controller()
export class MusicVotingController {
  constructor(private readonly service: MusicVotingService) {}

  @Get('music-tracks')
  @ApiOperation({ summary: 'Danh sách ca khúc' })
  listTracks(@Query('search') search?: string) {
    return this.service.listTracks(search);
  }

  @Post('music-tracks')
  @ApiOperation({ summary: 'Tạo ca khúc (metadata, không file)' })
  createTrack(@Body() dto: CreateMusicTrackDto) {
    return this.service.createTrack(dto);
  }

  @Post('music-tracks/bulk-delete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Xóa nhiều ca khúc — gỡ khỏi đợt bình chọn và phiếu liên quan trước khi xóa',
  })
  bulkRemoveTracks(@Body() dto: BulkDeleteMusicTracksDto) {
    return this.service.removeTracksBulk(dto.ids);
  }

  @Post('music-tracks/r2/init')
  @ApiOperation({
    summary: 'Khởi tạo upload ca khúc (presigned R2 hoặc fallback local)',
  })
  initNewTrackR2Upload(@Body() dto: InitMusicTrackR2UploadDto) {
    return this.service.initNewTrackR2Upload(dto);
  }

  @Post('music-tracks/:id/r2/init')
  @ApiOperation({ summary: 'Khởi tạo upload lại file nhạc (R2 / local)' })
  initTrackR2Reupload(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: InitMusicTrackR2ReuploadDto,
  ) {
    return this.service.initTrackR2Reupload(id, dto);
  }

  @Post('music-tracks/:id/r2/complete')
  @ApiOperation({ summary: 'Xác nhận upload R2 xong' })
  completeTrackR2Upload(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.completeTrackR2Upload(id);
  }

  @Post('music-tracks/with-audio')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Tạo ca khúc kèm upload file nhạc (một bước)' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: musicTrackIncomingStorage,
      limits: { fileSize: MUSIC_TRACK_MAX_BYTES },
    }),
  )
  @UsePipes(multipartValidationPipe)
  createTrackWithAudio(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CreateMusicTrackDto,
  ) {
    return this.service.createTrackWithAudio(dto, file);
  }

  @Patch('music-tracks/:id')
  updateTrack(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMusicTrackDto,
  ) {
    return this.service.updateTrack(id, dto);
  }

  @Delete('music-tracks/:id')
  @HttpCode(HttpStatus.OK)
  removeTrack(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.removeTrack(id);
  }

  @Post('music-tracks/:id/audio')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload file nhạc cho ca khúc' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: musicTrackByIdStorage,
      limits: { fileSize: MUSIC_TRACK_MAX_BYTES },
    }),
  )
  uploadTrackAudio(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.service.uploadTrackAudio(id, file);
  }

  @Get('music-tracks/:id/audio')
  @ApiOperation({ summary: 'Nghe file nhạc (admin)' })
  async streamTrackAudio(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    await this.service.writeTrackAudioHttpResponse(
      id,
      { admin: true },
      req,
      res,
    );
  }

  @Get('voting-campaigns')
  listCampaigns() {
    return this.service.listCampaigns();
  }

  @Get('voting-campaigns/:id')
  getCampaign(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getCampaign(id, true);
  }

  @Get('voting-campaigns/:id/stats')
  @ApiOperation({
    summary: 'Thống kê phiếu VALID từ DB (admin — luôn xem được)',
  })
  getStats(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getCampaignStats(id);
  }

  @Post('voting-campaigns')
  createCampaign(@Body() dto: CreateVotingCampaignDto) {
    return this.service.createCampaign(dto);
  }

  @Patch('voting-campaigns/:id')
  updateCampaign(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateVotingCampaignDto,
  ) {
    return this.service.updateCampaign(id, dto);
  }

  @Delete('voting-campaigns/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Xóa đợt bình chọn (kèm bài gán, whitelist, phiếu bình chọn)',
  })
  removeCampaign(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.removeCampaign(id);
  }

  @Post('voting-campaigns/:id/tracks')
  addTrack(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddCampaignTrackDto,
  ) {
    return this.service.addCampaignTrack(id, dto);
  }

  @Delete('voting-campaigns/:campaignId/tracks/:linkId')
  @HttpCode(HttpStatus.OK)
  removeTrackLink(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Param('linkId', ParseUUIDPipe) linkId: string,
  ) {
    return this.service.removeCampaignTrack(campaignId, linkId);
  }

  @Put('voting-campaigns/:id/tracks')
  @ApiOperation({ summary: 'Gán danh sách ca khúc cho đợt bình chọn (thay thế toàn bộ)' })
  setCampaignTracks(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetCampaignTracksDto,
  ) {
    return this.service.setCampaignTracks(id, dto.trackIds);
  }

  @Post('voting-campaigns/:id/tracks/import-song-codes')
  @ApiOperation({
    summary: 'Import danh sách bài bình chọn từ mã ca khúc (Excel → JSON)',
  })
  importCampaignTracks(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ImportCampaignTracksDto,
  ) {
    return this.service.importCampaignTracksBySongCodes(id, dto.songCodes);
  }

  @Get('voting-campaigns/:id/voters')
  @ApiOperation({ summary: 'Danh sách nhân viên được bình chọn (whitelist)' })
  listCampaignVoters(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.listCampaignVoters(id);
  }

  @Delete('voting-campaigns/:id/voters')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Xóa toàn bộ whitelist nhân viên của đợt' })
  clearCampaignVoters(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.clearCampaignVoters(id);
  }

  @Post('voting-campaigns/:id/voters/import')
  @ApiOperation({
    summary: 'Import whitelist nhân viên (Excel → JSON, thay thế toàn bộ)',
  })
  importCampaignVoters(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ImportCampaignVotersDto,
  ) {
    return this.service.importCampaignVoters(id, dto.voters);
  }
}
