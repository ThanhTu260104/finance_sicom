import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsUUID } from 'class-validator';
import { CreateProjectReportSubmissionDto } from './create-project-report-submission.dto';

export class SubmitProjectReportSubmissionDto extends CreateProjectReportSubmissionDto {
  @ApiProperty({
    type: [String],
    description: 'ID file đã upload qua PUT staged (tối đa 10)',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @IsUUID('4', { each: true })
  fileIds!: string[];
}
