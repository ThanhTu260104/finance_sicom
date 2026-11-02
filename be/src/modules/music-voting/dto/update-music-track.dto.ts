import { PartialType } from '@nestjs/swagger';
import { CreateMusicTrackDto } from './create-music-track.dto';

export class UpdateMusicTrackDto extends PartialType(CreateMusicTrackDto) {}
