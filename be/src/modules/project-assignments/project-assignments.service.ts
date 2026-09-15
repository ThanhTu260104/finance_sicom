import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateProjectAssignmentDto } from './dto/create-project-assignment.dto';
import { UpdateProjectAssignmentDto } from './dto/update-project-assignment.dto';

@Injectable()
export class ProjectAssignmentsService {
  constructor(private readonly prisma: PrismaService) {}

  private assertDateRange(startDate?: string, endDate?: string) {
    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      throw new BadRequestException(
        'startDate must be less than or equal to endDate',
      );
    }
  }

  private async ensureProject(projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, deletedAt: null },
    });
    if (!project) {
      throw new NotFoundException(`Project ${projectId} not found`);
    }
    return project;
  }

  async findByProject(projectId: string) {
    await this.ensureProject(projectId);
    return this.prisma.projectAssignment.findMany({
      where: { projectId },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async create(projectId: string, dto: CreateProjectAssignmentDto) {
    await this.ensureProject(projectId);
    this.assertDateRange(dto.startDate, dto.endDate);

    return this.prisma.projectAssignment.create({
      data: {
        projectId,
        employeeId: dto.employeeId,
        role: dto.role,
        isPrimary: dto.isPrimary ?? false,
        note: dto.note,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      },
    });
  }

  async update(id: string, dto: UpdateProjectAssignmentDto) {
    const assignment = await this.prisma.projectAssignment.findUnique({
      where: { id },
    });
    if (!assignment) {
      throw new NotFoundException(`Project assignment ${id} not found`);
    }

    this.assertDateRange(dto.startDate, dto.endDate);

    return this.prisma.projectAssignment.update({
      where: { id },
      data: {
        ...dto,
        startDate:
          dto.startDate !== undefined
            ? dto.startDate
              ? new Date(dto.startDate)
              : null
            : undefined,
        endDate:
          dto.endDate !== undefined
            ? dto.endDate
              ? new Date(dto.endDate)
              : null
            : undefined,
      },
    });
  }

  async remove(id: string) {
    const assignment = await this.prisma.projectAssignment.findUnique({
      where: { id },
    });
    if (!assignment) {
      throw new NotFoundException(`Project assignment ${id} not found`);
    }

    return this.prisma.projectAssignment.delete({ where: { id } });
  }
}
