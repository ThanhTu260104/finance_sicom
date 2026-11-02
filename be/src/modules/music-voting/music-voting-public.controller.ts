import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { MusicVotingService } from './music-voting.service';
import { SubmitVoteDto } from './dto/submit-vote.dto';
import { VerifyCampaignVoterDto } from './dto/verify-campaign-voter.dto';

@ApiTags('music-voting-public')
@Controller('public/voting')
export class MusicVotingPublicController {
  constructor(private readonly service: MusicVotingService) {}

  @Public()
  @Get('tracks')
  @ApiOperation({ summary: 'Danh sách ca khúc công khai để nghe' })
  listPublicTracks() {
    return this.service.listPublicTracks();
  }

  @Public()
  @Get('tracks/:id/audio')
  @ApiOperation({ summary: 'Stream audio ca khúc công khai' })
  async streamTrackAudio(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    await this.service.writeTrackAudioHttpResponse(
      id,
      { publicListen: true },
      req,
      res,
    );
  }

  @Public()
  @Get('ballot')
  @ApiOperation({
    summary:
      'Phiếu công khai — đợt ACTIVE hoặc toàn bộ ca khúc nếu chưa có đợt/bài gán',
  })
  getBallot(@Query('campaignId') campaignId?: string) {
    return this.service.getPublicBallot(campaignId?.trim() || undefined);
  }

  @Public()
  @Get('campaigns/:id')
  @ApiOperation({ summary: 'Thông tin đợt + ca khúc (công khai)' })
  getCampaign(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getPublicCampaign(id);
  }

  @Public()
  @Get('campaigns/:id/stats')
  @ApiOperation({
    summary: 'Bảng xếp hạng — chỉ khi đã công bố / hết đợt',
  })
  getStats(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getCampaignStats(id, { publicView: true });
  }

  @Public()
  @Post('campaigns/:id/voters/verify')
  @ApiOperation({ summary: 'Kiểm tra mã nhân viên có trong whitelist đợt' })
  verifyVoter(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VerifyCampaignVoterDto,
  ) {
    return this.service.verifyCampaignVoter(id, dto);
  }

  @Public()
  @Post('campaigns/:id/votes')
  @ApiOperation({
    summary: 'Gửi phiếu bình chọn — server ghi DB, không nhận tổng từ client',
  })
  submitVote(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SubmitVoteDto,
    @Req() req: Request,
  ) {
    return this.service.submitVote(id, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }
}
