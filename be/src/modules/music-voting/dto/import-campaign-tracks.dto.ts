import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsString, MaxLength } from 'class-validator';

export class ImportCampaignTracksDto {
  @ApiProperty({
    type: [String],
    description: 'Danh sách mã ca khúc từ Excel (cột maCaKhuc / songCode)',
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  songCodes: string[];
}
