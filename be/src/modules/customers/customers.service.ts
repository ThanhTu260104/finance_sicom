import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CustomerStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  buildPaginatedResult,
  PaginatedResult,
} from '../../common/dto/pagination-query.dto';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { QueryCustomerDto } from './dto/query-customer.dto';
import { BulkCustomerDto } from './dto/bulk-customer.dto';

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  private isUniqueConflict(err: unknown) {
    return (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002'
    );
  }

  async create(dto: CreateCustomerDto) {
    const existing = await this.prisma.customer.findFirst({
      where: {
        code: { equals: dto.code, mode: 'insensitive' },
        deletedAt: null,
      },
    });
    if (existing) {
      throw new ConflictException(
        `Mã khách hàng "${dto.code}" đã tồn tại. Hãy dùng mã khác hoặc sửa bản ghi hiện có.`,
      );
    }

    const softDeleted = await this.prisma.customer.findFirst({
      where: {
        code: { equals: dto.code, mode: 'insensitive' },
        deletedAt: { not: null },
      },
    });
    if (softDeleted) {
      return this.prisma.customer.update({
        where: { id: softDeleted.id },
        data: {
          ...dto,
          code: dto.code.trim(),
          deletedAt: null,
          status: dto.status ?? CustomerStatus.ACTIVE,
        },
      });
    }

    try {
      return await this.prisma.customer.create({
        data: { ...dto, code: dto.code.trim() },
      });
    } catch (err) {
      if (this.isUniqueConflict(err)) {
        throw new ConflictException(`Mã khách hàng "${dto.code}" đã tồn tại.`);
      }
      throw err;
    }
  }

  async findAll(query: QueryCustomerDto): Promise<PaginatedResult<unknown>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const where: Prisma.CustomerWhereInput = {
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.partnerType
        ? { partnerTypes: { has: query.partnerType } }
        : {}),
      ...(query.search
        ? {
            OR: [
              { code: { contains: query.search, mode: 'insensitive' } },
              { name: { contains: query.search, mode: 'insensitive' } },
              { taxCode: { contains: query.search, mode: 'insensitive' } },
              { contactName: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const sortBy = query.sortBy ?? 'createdAt';
    const sortOrder = query.sortOrder ?? 'desc';
    const allowedSort = ['createdAt', 'updatedAt', 'code', 'name', 'status'];
    const orderByField = allowedSort.includes(sortBy) ? sortBy : 'createdAt';

    const [data, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [orderByField]: sortOrder },
      }),
      this.prisma.customer.count({ where }),
    ]);

    return buildPaginatedResult(data, total, page, limit);
  }

  async findOne(id: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id, deletedAt: null },
      include: {
        projects: {
          where: { deletedAt: null },
          select: { id: true, code: true, name: true, status: true },
        },
      },
    });
    if (!customer) {
      throw new NotFoundException(`Không tìm thấy khách hàng ${id}`);
    }
    return customer;
  }

  async update(id: string, dto: UpdateCustomerDto) {
    await this.findOne(id);

    if (dto.code) {
      const existing = await this.prisma.customer.findFirst({
        where: {
          code: { equals: dto.code, mode: 'insensitive' },
          deletedAt: null,
          NOT: { id },
        },
      });
      if (existing) {
        throw new ConflictException(`Mã khách hàng "${dto.code}" đã tồn tại.`);
      }
    }

    try {
      return await this.prisma.customer.update({
        where: { id },
        data: dto,
      });
    } catch (err) {
      if (this.isUniqueConflict(err)) {
        throw new ConflictException(`Mã khách hàng "${dto.code}" đã tồn tại.`);
      }
      throw err;
    }
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.customer.update({
      where: { id },
      data: { deletedAt: new Date(), status: CustomerStatus.INACTIVE },
    });
  }

  async bulkUpsert(dto: BulkCustomerDto) {
    if (!dto.items?.length) {
      throw new BadRequestException('Không có dòng khách hàng để nhập');
    }

    const seen = new Set<string>();
    for (const item of dto.items) {
      const key = item.code.trim().toLowerCase();
      if (!key) {
        throw new BadRequestException('Có dòng thiếu mã khách hàng');
      }
      if (seen.has(key)) {
        throw new BadRequestException(
          `Trùng mã khách hàng trong file: "${item.code}". Mỗi mã chỉ được xuất hiện một lần.`,
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
        const existing = await this.prisma.customer.findFirst({
          where: {
            code: { equals: code, mode: 'insensitive' },
            deletedAt: null,
          },
        });

        const payload: CreateCustomerDto = {
          ...item,
          code,
          name: item.name.trim(),
        };

        if (existing) {
          if (item.partnerTypes?.length) {
            payload.partnerTypes = [
              ...new Set([...existing.partnerTypes, ...item.partnerTypes]),
            ];
          }
          const row = await this.update(existing.id, payload);
          results.push(row);
          updated += 1;
        } else {
          const softDeleted = await this.prisma.customer.findFirst({
            where: {
              code: { equals: code, mode: 'insensitive' },
              deletedAt: { not: null },
            },
          });
          if (softDeleted) {
            const row = await this.prisma.customer.update({
              where: { id: softDeleted.id },
              data: {
                ...payload,
                deletedAt: null,
                status: payload.status ?? CustomerStatus.ACTIVE,
              },
            });
            results.push(row);
            updated += 1;
          } else {
            const row = await this.create(payload);
            results.push(row);
            created += 1;
          }
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
            `Dòng ${rowNo}: mã khách hàng "${code}" đã tồn tại.`,
          );
        }
        throw new BadRequestException(
          `Dòng ${rowNo} (mã "${code}"): không lưu được. Kiểm tra dữ liệu (email, độ dài trường…) rồi thử lại.`,
        );
      }
    }

    return { count: results.length, created, updated, data: results };
  }
}
