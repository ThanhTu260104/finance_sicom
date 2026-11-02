import { ApiProperty } from '@nestjs/swagger';
import { ArrayUnique, IsArray, IsUUID } from 'class-validator';

export class SetCampaignTracksDto {
  @ApiProperty({ type: [String], description: 'Danh sách id ca khúc trong đợt bình chọn' })
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  trackIds: string[];
}
