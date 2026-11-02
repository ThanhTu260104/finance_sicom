import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CustomerStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  buildPaginatedResult,
  PaginatedResult,
} from '../../common/dto/pagination-query.dto';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { QueryCompanyDto } from './dto/query-company.dto';

@Injectable()
export class CompaniesService {
  constructor(private readonly prisma: PrismaService) {}

  private isUniqueConflict(err: unknown) {
    return (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002'
    );
  }

  async create(dto: CreateCompanyDto) {
    const code = dto.code.trim();
    const existing = await this.prisma.company.findFirst({
      where: { code: { equals: code, mode: 'insensitive' } },
    });
    if (existing && !existing.deletedAt) {
      throw new ConflictException(`Mã công ty "${code}" đã tồn tại.`);
    }
    if (existing) {
      return this.prisma.company.update({
        where: { id: existing.id },
        data: {
          ...dto,
          code,
          deletedAt: null,
          status: dto.status ?? CustomerStatus.ACTIVE,
        },
      });
    }
    try {
      return await this.prisma.company.create({ data: { ...dto, code } });
    } catch (err) {
      if (this.isUniqueConflict(err)) {
        throw new ConflictException(`Mã công ty "${code}" đã tồn tại.`);
      }
      throw err;
    }
  }

  async findAll(query: QueryCompanyDto): Promise<PaginatedResult<unknown>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const where: Prisma.CompanyWhereInput = {
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { code: { contains: query.search, mode: 'insensitive' } },
              { name: { contains: query.search, mode: 'insensitive' } },
              { taxCode: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.company.findMany({
        where,
        skip,
        take: limit,
        orderBy: { code: 'asc' },
        include: {
          _count: { select: { contracts: { where: { deletedAt: null } } } },
        },
      }),
      this.prisma.company.count({ where }),
    ]);

    return buildPaginatedResult(data, total, page, limit);
  }

  async findOne(id: string) {
    const company = await this.prisma.company.findFirst({
      where: { id, deletedAt: null },
    });
    if (!company) {
      throw new NotFoundException(`Không tìm thấy công ty ${id}`);
    }
    return company;
  }

  async update(id: string, dto: UpdateCompanyDto) {
    await this.findOne(id);
    if (dto.code) {
      const existing = await this.prisma.company.findFirst({
        where: {
          code: { equals: dto.code, mode: 'insensitive' },
          NOT: { id },
        },
      });
      if (existing) {
        throw new ConflictException(`Mã công ty "${dto.code}" đã tồn tại.`);
      }
    }
    try {
      return await this.prisma.company.update({ where: { id }, data: dto });
    } catch (err) {
      if (this.isUniqueConflict(err)) {
        throw new ConflictException(`Mã công ty "${dto.code}" đã tồn tại.`);
      }
      throw err;
    }
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.company.update({
      where: { id },
      data: { deletedAt: new Date(), status: CustomerStatus.INACTIVE },
    });
  }
}
