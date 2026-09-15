import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ContractStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  buildPaginatedResult,
  PaginatedResult,
} from '../../common/dto/pagination-query.dto';
import { CreateContractDto } from './dto/create-contract.dto';
import { UpdateContractDto } from './dto/update-contract.dto';
import { QueryContractDto } from './dto/query-contract.dto';
import {
  BulkContractDto,
} from './dto/bulk-contract.dto';

@Injectable()
export class ContractsService {
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

  async create(dto: CreateContractDto) {
    await this.ensureProject(dto.projectId);
    this.assertDateRange(dto.startDate, dto.endDate);

    const existing = await this.prisma.contract.findFirst({
      where: { contractNo: dto.contractNo, deletedAt: null },
    });
    if (existing) {
      throw new ConflictException(
        `Contract number "${dto.contractNo}" already exists`,
      );
    }

    return this.prisma.contract.create({
      data: {
        projectId: dto.projectId,
        contractNo: dto.contractNo,
        name: dto.name,
        contractType: dto.contractType,
        contractValue: dto.contractValue,
        billingCycle: dto.billingCycle,
        status: dto.status ?? ContractStatus.DRAFT,
        paymentTermDays: dto.paymentTermDays ?? 60,
        note: dto.note,
        signedDate: dto.signedDate ? new Date(dto.signedDate) : undefined,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      },
      include: {
        project: { select: { id: true, code: true, name: true } },
      },
    });
  }

  async findAll(query: QueryContractDto): Promise<PaginatedResult<unknown>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const where: Prisma.ContractWhereInput = {
      deletedAt: null,
      ...(query.projectId ? { projectId: query.projectId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.contractType ? { contractType: query.contractType } : {}),
      ...(query.billingCycle ? { billingCycle: query.billingCycle } : {}),
      ...(query.search
        ? {
            OR: [
              { contractNo: { contains: query.search, mode: 'insensitive' } },
              { name: { contains: query.search, mode: 'insensitive' } },
              {
                project: {
                  name: { contains: query.search, mode: 'insensitive' },
                },
              },
            ],
          }
        : {}),
    };

    const sortBy = query.sortBy ?? 'createdAt';
    const sortOrder = query.sortOrder ?? 'desc';
    const allowedSort = [
      'createdAt',
      'updatedAt',
      'contractNo',
      'name',
      'contractValue',
      'signedDate',
      'startDate',
      'endDate',
      'status',
    ];
    const orderByField = allowedSort.includes(sortBy) ? sortBy : 'createdAt';

    const [data, total] = await Promise.all([
      this.prisma.contract.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [orderByField]: sortOrder },
        include: {
          project: { select: { id: true, code: true, name: true } },
        },
      }),
      this.prisma.contract.count({ where }),
    ]);

    return buildPaginatedResult(data, total, page, limit);
  }

  async findOne(id: string) {
    const contract = await this.prisma.contract.findFirst({
      where: { id, deletedAt: null },
      include: {
        project: {
          select: {
            id: true,
            code: true,
            name: true,
            customer: { select: { id: true, code: true, name: true } },
          },
        },
      },
    });
    if (!contract) {
      throw new NotFoundException(`Contract ${id} not found`);
    }
    return contract;
  }

  async update(id: string, dto: UpdateContractDto) {
    await this.findOne(id);
    this.assertDateRange(dto.startDate, dto.endDate);

    if (dto.projectId) {
      await this.ensureProject(dto.projectId);
    }

    if (dto.contractNo) {
      const existing = await this.prisma.contract.findFirst({
        where: { contractNo: dto.contractNo, deletedAt: null, NOT: { id } },
      });
      if (existing) {
        throw new ConflictException(
          `Contract number "${dto.contractNo}" already exists`,
        );
      }
    }

    return this.prisma.contract.update({
      where: { id },
      data: {
        ...dto,
        signedDate:
          dto.signedDate !== undefined
            ? dto.signedDate
              ? new Date(dto.signedDate)
              : null
            : undefined,
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
      include: {
        project: { select: { id: true, code: true, name: true } },
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.contract.update({
      where: { id },
      data: { deletedAt: new Date(), status: ContractStatus.CANCELLED },
    });
  }

  private async resolveProjectIdByCode(projectCode: string) {
    const project = await this.prisma.project.findFirst({
      where: { code: projectCode, deletedAt: null },
    });
    if (!project) {
      throw new NotFoundException(`Project code "${projectCode}" not found`);
    }
    return project.id;
  }

  async bulkUpsert(dto: BulkContractDto) {
    if (!dto.items?.length) {
      throw new BadRequestException('No contract items to upsert');
    }

    const seen = new Set<string>();
    for (const item of dto.items) {
      const key = item.contractNo.trim().toLowerCase();
      if (seen.has(key)) {
        throw new BadRequestException(
          `Duplicate contractNo in import: "${item.contractNo}"`,
        );
      }
      seen.add(key);
    }

    const results = [];
    let created = 0;
    let updated = 0;

    for (const item of dto.items) {
      const projectId = await this.resolveProjectIdByCode(item.projectCode);
      const payload: CreateContractDto = {
        projectId,
        contractNo: item.contractNo,
        name: item.name,
        contractType: item.contractType,
        contractValue: item.contractValue,
        billingCycle: item.billingCycle,
        status: item.status,
        signedDate: item.signedDate,
        startDate: item.startDate,
        endDate: item.endDate,
        note: item.note,
        paymentTermDays: item.paymentTermDays,
      };

      const existing = await this.prisma.contract.findFirst({
        where: { contractNo: item.contractNo, deletedAt: null },
      });

      if (existing) {
        const row = await this.update(existing.id, payload);
        results.push(row);
        updated += 1;
      } else {
        const row = await this.create(payload);
        results.push(row);
        created += 1;
      }
    }

    return { count: results.length, created, updated, data: results };
  }
}
