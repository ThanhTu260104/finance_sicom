import { Module } from '@nestjs/common';
import { MusicVotingController } from './music-voting.controller';
import { MusicVotingPublicController } from './music-voting-public.controller';
import { MusicVotingService } from './music-voting.service';
import { MusicTrackR2Service } from './music-track-r2.service';

@Module({
  controllers: [MusicVotingController, MusicVotingPublicController],
  providers: [MusicVotingService, MusicTrackR2Service],
  exports: [MusicVotingService],
})
export class MusicVotingModule {}
