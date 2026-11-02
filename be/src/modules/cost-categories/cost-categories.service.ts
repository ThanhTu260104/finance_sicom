import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EmployeeStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  buildPaginatedResult,
  PaginatedResult,
} from '../../common/dto/pagination-query.dto';
import { CreateCostCategoryDto } from './dto/create-cost-category.dto';
import { UpdateCostCategoryDto } from './dto/update-cost-category.dto';
import { QueryCostCategoryDto } from './dto/query-cost-category.dto';
import { BulkCostCategoryDto } from './dto/bulk-cost-category.dto';

@Injectable()
export class CostCategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  private isUniqueConflict(err: unknown) {
    return (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002'
    );
  }

  async create(dto: CreateCostCategoryDto) {
    const code = dto.code.trim();
    const existing = await this.prisma.costCategory.findFirst({
      where: {
        code: { equals: code, mode: 'insensitive' },
        deletedAt: null,
      },
    });
    if (existing) {
      throw new ConflictException(`Mã loại chi phí "${code}" đã tồn tại.`);
    }

    return this.prisma.costCategory.create({
      data: {
        code,
        name: dto.name.trim(),
        sortOrder: dto.sortOrder ?? 0,
        status: dto.status ?? EmployeeStatus.ACTIVE,
        note: dto.note,
      },
    });
  }

  async findAll(query: QueryCostCategoryDto): Promise<PaginatedResult<unknown>> {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 10, 100);
    const skip = (page - 1) * limit;

    const where: Prisma.CostCategoryWhereInput = {
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { code: { contains: query.search, mode: 'insensitive' } },
              { name: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.costCategory.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
      }),
      this.prisma.costCategory.count({ where }),
    ]);

    return buildPaginatedResult(data, total, page, limit);
  }

  async findOne(id: string) {
    const row = await this.prisma.costCategory.findFirst({
      where: { id, deletedAt: null },
    });
    if (!row) {
      throw new NotFoundException(`Cost category ${id} not found`);
    }
    return row;
  }

  async update(id: string, dto: UpdateCostCategoryDto) {
    await this.findOne(id);

    if (dto.code) {
      const dup = await this.prisma.costCategory.findFirst({
        where: {
          code: { equals: dto.code, mode: 'insensitive' },
          deletedAt: null,
          NOT: { id },
        },
      });
      if (dup) {
        throw new ConflictException(`Mã "${dto.code}" đã tồn tại.`);
      }
    }

    return this.prisma.costCategory.update({
      where: { id },
      data: {
        ...dto,
        ...(dto.code ? { code: dto.code.trim() } : {}),
        ...(dto.name ? { name: dto.name.trim() } : {}),
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    const inUse = await this.prisma.projectOperatingCost.count({
      where: { categoryId: id },
    });
    if (inUse > 0) {
      throw new ConflictException(
        'Không xóa được loại chi phí đang có dòng chi phí dự án.',
      );
    }
    return this.prisma.costCategory.update({
      where: { id },
      data: { deletedAt: new Date(), status: EmployeeStatus.INACTIVE },
    });
  }

  async bulkUpsert(dto: BulkCostCategoryDto) {
    if (!dto.items?.length) {
      throw new BadRequestException('Không có dòng loại chi phí để nhập');
    }

    const seen = new Set<string>();
    for (const item of dto.items) {
      const key = item.code.trim().toLowerCase();
      if (seen.has(key)) {
        throw new BadRequestException(`Trùng mã trong file: ${item.code}`);
      }
      seen.add(key);
    }

    const results = [];
    let created = 0;
    let updated = 0;

    for (const [index, item] of dto.items.entries()) {
      const rowNo = index + 1;
      const code = item.code.trim();
      try {
        const existing = await this.prisma.costCategory.findFirst({
          where: {
            code: { equals: code, mode: 'insensitive' },
            deletedAt: null,
          },
        });
        const payload: CreateCostCategoryDto = {
          ...item,
          code,
          name: item.name.trim(),
        };
        if (existing) {
          const row = await this.update(existing.id, payload);
          results.push(row);
          updated += 1;
        } else {
          const row = await this.create(payload);
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
            : raw || err.message;
          throw new BadRequestException(`Dòng ${rowNo} (${code}): ${msg}`);
        }
        throw new BadRequestException(`Dòng ${rowNo} (${code}): lỗi không xác định`);
      }
    }

    return { count: results.length, created, updated, data: results };
  }
}
