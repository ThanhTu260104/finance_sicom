import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ProjectAssignmentsService } from './project-assignments.service';
import { CreateProjectAssignmentDto } from './dto/create-project-assignment.dto';
import { UpdateProjectAssignmentDto } from './dto/update-project-assignment.dto';

@ApiTags('project-assignments')
@Controller()
export class ProjectAssignmentsController {
  constructor(
    private readonly projectAssignmentsService: ProjectAssignmentsService,
  ) {}

  @Get('projects/:projectId/assignments')
  @ApiOperation({ summary: 'List project assignments' })
  findByProject(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.projectAssignmentsService.findByProject(projectId);
  }

  @Post('projects/:projectId/assignments')
  @ApiOperation({ summary: 'Create project assignment' })
  create(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: CreateProjectAssignmentDto,
  ) {
    return this.projectAssignmentsService.create(projectId, dto);
  }

  @Patch('project-assignments/:id')
  @ApiOperation({ summary: 'Update project assignment' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProjectAssignmentDto,
  ) {
    return this.projectAssignmentsService.update(id, dto);
  }

  @Delete('project-assignments/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete project assignment' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.projectAssignmentsService.remove(id);
  }
}
