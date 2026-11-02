import { Module } from '@nestjs/common';
import { ProjectOperatingCostsController } from './project-operating-costs.controller';
import { ProjectOperatingCostsService } from './project-operating-costs.service';

@Module({
  controllers: [ProjectOperatingCostsController],
  providers: [ProjectOperatingCostsService],
  exports: [ProjectOperatingCostsService],
})
export class ProjectOperatingCostsModule {}
