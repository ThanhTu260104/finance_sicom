import {
  BadRequestException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateProjectAssignmentDto } from './dto/create-project-assignment.dto';
import { UpdateProjectAssignmentDto } from './dto/update-project-assignment.dto';
import { BulkProjectAssignmentDto } from './dto/bulk-project-assignment.dto';

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
      orderBy: [{ role: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async create(projectId: string, dto: CreateProjectAssignmentDto) {
    await this.ensureProject(projectId);
    this.assertDateRange(dto.startDate, dto.endDate);

    const existing = await this.prisma.projectAssignment.findUnique({
      where: {
        projectId_role: { projectId, role: dto.role },
      },
    });
    if (existing) {
      throw new BadRequestException(
        `Vai trò ${dto.role} đã có trên dự án. Hãy sửa dòng hiện có hoặc dùng nhập Excel (upsert).`,
      );
    }

    return this.prisma.projectAssignment.create({
      data: {
        projectId,
        role: dto.role,
        quantity: dto.quantity ?? 1,
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

    if (dto.role && dto.role !== assignment.role) {
      const dup = await this.prisma.projectAssignment.findUnique({
        where: {
          projectId_role: { projectId: assignment.projectId, role: dto.role },
        },
      });
      if (dup && dup.id !== id) {
        throw new BadRequestException(
          `Vai trò ${dto.role} đã tồn tại trên dự án.`,
        );
      }
    }

    const { startDate, endDate, ...rest } = dto;

    return this.prisma.projectAssignment.update({
      where: { id },
      data: {
        ...rest,
        startDate:
          startDate !== undefined
            ? startDate
              ? new Date(startDate)
              : null
            : undefined,
        endDate:
          endDate !== undefined
            ? endDate
              ? new Date(endDate)
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

  async bulkUpsert(projectId: string, dto: BulkProjectAssignmentDto) {
    await this.ensureProject(projectId);
    if (!dto.items?.length) {
      throw new BadRequestException('Không có dòng phân công để nhập');
    }

    const seen = new Set<string>();
    for (const item of dto.items) {
      const key = item.role;
      if (seen.has(key)) {
        throw new BadRequestException(
          `Trùng vai trò trong file: "${item.role}". Mỗi vai trò một dòng.`,
        );
      }
      seen.add(key);
    }

    const results = [];
    let created = 0;
    let updated = 0;

    for (const [index, item] of dto.items.entries()) {
      const rowNo = index + 1;
      this.assertDateRange(item.startDate, item.endDate);

      try {
        const existing = await this.prisma.projectAssignment.findUnique({
          where: {
            projectId_role: { projectId, role: item.role },
          },
        });

        const data = {
          quantity: item.quantity ?? 1,
          note: item.note,
          startDate: item.startDate ? new Date(item.startDate) : null,
          endDate: item.endDate ? new Date(item.endDate) : null,
        };

        if (existing) {
          const row = await this.prisma.projectAssignment.update({
            where: { id: existing.id },
            data,
          });
          results.push(row);
          updated += 1;
        } else {
          const row = await this.prisma.projectAssignment.create({
            data: {
              projectId,
              role: item.role,
              ...data,
            },
          });
          results.push(row);
          created += 1;
        }
      } catch (err) {
        if (err instanceof HttpException) {
          const response = err.getResponse();
          const raw =
            typeof response === 'string'
              ? response
              : (response as { message?: string | string[] })?.message;
          const msg = Array.isArray(raw)
            ? raw.join(' · ')
            : raw || err.message || 'Dữ liệu không hợp lệ';
          throw new BadRequestException(
            `Dòng ${rowNo} (${item.role}): ${msg}`,
          );
        }
        throw new BadRequestException(
          `Dòng ${rowNo} (${item.role}): không lưu được.`,
        );
      }
    }

    return { count: results.length, created, updated, data: results };
  }
}
