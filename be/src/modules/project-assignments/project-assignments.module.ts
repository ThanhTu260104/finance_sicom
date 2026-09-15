import { Module } from '@nestjs/common';
import { ProjectAssignmentsController } from './project-assignments.controller';
import { ProjectAssignmentsService } from './project-assignments.service';

@Module({
  controllers: [ProjectAssignmentsController],
  providers: [ProjectAssignmentsService],
  exports: [ProjectAssignmentsService],
})
export class ProjectAssignmentsModule {}
