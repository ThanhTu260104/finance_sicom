import { Module } from '@nestjs/common';
import { ProjectReportSubmissionsController } from './project-report-submissions.controller';
import { ProjectReportR2Service } from './project-report-r2.service';
import { ProjectReportSubmissionsService } from './project-report-submissions.service';

@Module({
  controllers: [ProjectReportSubmissionsController],
  providers: [ProjectReportR2Service, ProjectReportSubmissionsService],
})
export class ProjectReportSubmissionsModule {}
