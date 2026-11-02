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
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { QueryEmployeeDto } from './dto/query-employee.dto';
import { BulkEmployeeDto } from './dto/bulk-employee.dto';

@Injectable()
export class EmployeesService {
  constructor(private readonly prisma: PrismaService) {}

  private isUniqueConflict(err: unknown) {
    return (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002'
    );
  }

  async create(dto: CreateEmployeeDto) {
    const existing = await this.prisma.employee.findFirst({
      where: {
        code: { equals: dto.code, mode: 'insensitive' },
        deletedAt: null,
      },
    });
    if (existing) {
      throw new ConflictException(
        `Mã nhân viên "${dto.code}" đã tồn tại.`,
      );
    }

    const softDeleted = await this.prisma.employee.findFirst({
      where: {
        code: { equals: dto.code, mode: 'insensitive' },
        deletedAt: { not: null },
      },
    });
    if (softDeleted) {
      return this.prisma.employee.update({
        where: { id: softDeleted.id },
        data: {
          ...dto,
          code: dto.code.trim(),
          deletedAt: null,
          status: dto.status ?? EmployeeStatus.ACTIVE,
        },
      });
    }

    try {
      return await this.prisma.employee.create({
        data: {
          ...dto,
          code: dto.code.trim(),
          status: dto.status ?? EmployeeStatus.ACTIVE,
        },
      });
    } catch (err) {
      if (this.isUniqueConflict(err)) {
        throw new ConflictException(
          `Mã nhân viên "${dto.code}" đã tồn tại.`,
        );
      }
      throw err;
    }
  }

  async findAll(query: QueryEmployeeDto): Promise<PaginatedResult<unknown>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const where: Prisma.EmployeeWhereInput = {
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { code: { contains: query.search, mode: 'insensitive' } },
              { fullName: { contains: query.search, mode: 'insensitive' } },
              { jobTitle: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.employee.findMany({
        where,
        skip,
        take: limit,
        orderBy: { code: 'asc' },
      }),
      this.prisma.employee.count({ where }),
    ]);

    return buildPaginatedResult(data, total, page, limit);
  }

  async findOne(id: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { id, deletedAt: null },
    });
    if (!employee) {
      throw new NotFoundException(`Employee ${id} not found`);
    }
    return employee;
  }

  async update(id: string, dto: UpdateEmployeeDto) {
    await this.findOne(id);

    if (dto.code) {
      const dup = await this.prisma.employee.findFirst({
        where: {
          code: { equals: dto.code, mode: 'insensitive' },
          deletedAt: null,
          NOT: { id },
        },
      });
      if (dup) {
        throw new ConflictException(
          `Mã nhân viên "${dto.code}" đã tồn tại.`,
        );
      }
    }

    try {
      return await this.prisma.employee.update({
        where: { id },
        data: {
          ...dto,
          ...(dto.code ? { code: dto.code.trim() } : {}),
        },
      });
    } catch (err) {
      if (this.isUniqueConflict(err)) {
        throw new ConflictException(`Mã nhân viên đã tồn tại.`);
      }
      throw err;
    }
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.employee.update({
      where: { id },
      data: { deletedAt: new Date(), status: EmployeeStatus.INACTIVE },
    });
  }

  async bulkUpsert(dto: BulkEmployeeDto) {
    if (!dto.items?.length) {
      throw new BadRequestException('Không có dòng nhân viên để nhập');
    }

    const seen = new Set<string>();
    for (const item of dto.items) {
      const key = item.code.trim().toLowerCase();
      if (!key) {
        throw new BadRequestException('Có dòng thiếu mã nhân viên');
      }
      if (seen.has(key)) {
        throw new BadRequestException(
          `Trùng mã nhân viên trong file: "${item.code}". Mỗi mã chỉ được xuất hiện một lần.`,
        );
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
        const existing = await this.prisma.employee.findFirst({
          where: {
            code: { equals: code, mode: 'insensitive' },
            deletedAt: null,
          },
        });

        const payload: CreateEmployeeDto = {
          ...item,
          code,
          fullName: item.fullName.trim(),
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
            : raw || err.message || 'Dữ liệu không hợp lệ';
          throw new BadRequestException(`Dòng ${rowNo} (mã "${code}"): ${msg}`);
        }
        if (this.isUniqueConflict(err)) {
          throw new ConflictException(
            `Dòng ${rowNo}: mã nhân viên "${code}" đã tồn tại.`,
          );
        }
        throw new BadRequestException(
          `Dòng ${rowNo} (mã "${code}"): không lưu được. Kiểm tra dữ liệu rồi thử lại.`,
        );
      }
    }

    return { count: results.length, created, updated, data: results };
  }
}
