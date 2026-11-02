import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsString, Max, Min } from 'class-validator';
import { MAX_UPLOAD_FILE_SIZE } from '../../../common/constants/upload.constants';

export class InitProjectReportStagedFileDto {
  @ApiProperty({ example: 'bao-cao-thang-10.xlsx' })
  @IsString()
  @IsNotEmpty()
  fileName!: string;

  @ApiProperty({ example: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  @IsString()
  @IsNotEmpty()
  mimeType!: string;

  @ApiProperty({ example: 524_288_000, description: 'Kích thước byte (client khai báo trước upload)' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_UPLOAD_FILE_SIZE)
  sizeBytes!: number;
}
