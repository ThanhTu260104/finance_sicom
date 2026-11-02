import {
  BadRequestException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ContractKind, EmployeeStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateProjectOperatingCostDto } from './dto/create-project-operating-cost.dto';
import { UpdateProjectOperatingCostDto } from './dto/update-project-operating-cost.dto';
import { BulkProjectOperatingCostDto } from './dto/bulk-project-operating-cost.dto';
import { OperatingCostTrendQueryDto } from './dto/operating-cost-trend-query.dto';
import { QueryProjectOperatingCostDto } from './dto/query-project-operating-cost.dto';
import {
  buildOperatingCostPeriodWhere,
  resolveOperatingCostPeriodRange,
} from './operating-cost-period.util';
import { Decimal } from '@prisma/client/runtime/library';
import { toDecimalString } from '../../common/utils/decimal.util';
import { Prisma } from '@prisma/client';

const categoryInclude = {
  category: {
    select: { id: true, code: true, name: true, sortOrder: true },
  },
} as const;

@Injectable()
export class ProjectOperatingCostsService {
  constructor(private readonly prisma: PrismaService) {}

  private async ensureProject(projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, deletedAt: null },
    });
    if (!project) {
      throw new NotFoundException(`Project ${projectId} not found`);
    }
    return project;
  }

  private async resolveCategory(dto: {
    categoryId?: string;
    categoryCode?: string;
  }) {
    if (dto.categoryId) {
      const row = await this.prisma.costCategory.findFirst({
        where: {
          id: dto.categoryId,
          deletedAt: null,
          status: EmployeeStatus.ACTIVE,
        },
      });
      if (!row) {
        throw new NotFoundException(
          'Loại chi phí không tồn tại hoặc ngừng dùng',
        );
      }
      return row;
    }
    const code = dto.categoryCode?.trim();
    if (code) {
      const row = await this.prisma.costCategory.findFirst({
        where: {
          code: { equals: code, mode: 'insensitive' },
          deletedAt: null,
          status: EmployeeStatus.ACTIVE,
        },
      });
      if (!row) {
        throw new NotFoundException(`Không tìm thấy loại chi phí mã "${code}"`);
      }
      return row;
    }
    throw new BadRequestException('Cần categoryId hoặc categoryCode');
  }

  async findByProject(
    projectId: string,
    query: QueryProjectOperatingCostDto = {},
  ) {
    await this.ensureProject(projectId);
    const periodWhere = buildOperatingCostPeriodWhere(query);
    return this.prisma.projectOperatingCost.findMany({
      where: {
        projectId,
        ...periodWhere,
      },
      orderBy: [{ period: 'desc' }, { createdAt: 'desc' }],
      include: categoryInclude,
    });
  }

  async getMonthlyTrend(
    scope: { projectId?: string } & OperatingCostTrendQueryDto,
  ) {
    if (scope.projectId) {
      await this.ensureProject(scope.projectId);
    }

    const { fromPeriod, toPeriod } = resolveOperatingCostPeriodRange({
      year: scope.year,
      fromPeriod: scope.fromPeriod,
      toPeriod: scope.toPeriod,
    });
    const periodWhere = buildOperatingCostPeriodWhere({
      fromPeriod,
      toPeriod,
    });

    const projectWhere: Prisma.ProjectWhereInput = {
      deletedAt: null,
      ...(scope.projectId ? { id: scope.projectId } : {}),
      ...(scope.customerId ? { customerId: scope.customerId } : {}),
    };

    const rows = await this.prisma.projectOperatingCost.findMany({
      where: {
        ...periodWhere,
        project: projectWhere,
      },
      include: categoryInclude,
      orderBy: [{ period: 'asc' }, { createdAt: 'asc' }],
    });

    type CatAgg = {
      categoryId: string;
      code: string;
      name: string;
      amount: Decimal;
    };
    const byPeriod = new Map<
      string,
      { total: Decimal; byCategory: Map<string, CatAgg> }
    >();

    for (const row of rows) {
      let bucket = byPeriod.get(row.period);
      if (!bucket) {
        bucket = { total: new Decimal(0), byCategory: new Map() };
        byPeriod.set(row.period, bucket);
      }
      bucket.total = bucket.total.add(row.amount);

      const cat = row.category;
      const catKey = row.categoryId;
      let catAgg = bucket.byCategory.get(catKey);
      if (!catAgg) {
        catAgg = {
          categoryId: catKey,
          code: cat.code,
          name: cat.name,
          amount: new Decimal(0),
        };
        bucket.byCategory.set(catKey, catAgg);
      }
      catAgg.amount = catAgg.amount.add(row.amount);
    }

    let grandTotal = new Decimal(0);
    const points = Array.from(byPeriod.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([period, bucket]) => {
        grandTotal = grandTotal.add(bucket.total);
        const byCategory = Array.from(bucket.byCategory.values())
          .sort((a, b) => a.code.localeCompare(b.code))
          .map((c) => ({
            categoryId: c.categoryId,
            code: c.code,
            name: c.name,
            amount: toDecimalString(c.amount),
          }));
        return {
          period,
          total: toDecimalString(bucket.total),
          byCategory,
        };
      });

    return {
      fromPeriod: fromPeriod ?? null,
      toPeriod: toPeriod ?? null,
      points,
      grandTotal: toDecimalString(grandTotal),
    };
  }

  /**
   * Chi phí thầu phụ / nhà cung cấp của dự án = số tiền đã chi (bản ghi chi trả
   * trên HĐ chi), tách riêng 2 nhóm theo kỳ YYYY-MM.
   */
  async getContractCosts(projectId: string, query: OperatingCostTrendQueryDto) {
    await this.ensureProject(projectId);
    const { fromPeriod, toPeriod } = resolveOperatingCostPeriodRange({
      year: query.year,
      fromPeriod: query.fromPeriod,
      toPeriod: query.toPeriod,
    });

    const contracts = await this.prisma.contract.findMany({
      where: {
        projectId,
        deletedAt: null,
        kind: { in: [ContractKind.SUBCONTRACTOR, ContractKind.SUPPLIER] },
      },
      orderBy: [{ kind: 'asc' }, { contractNo: 'asc' }],
      include: {
        company: { select: { id: true, code: true, name: true } },
        counterparty: { select: { id: true, code: true, name: true } },
        collections: {
          where: { deletedAt: null },
          select: { period: true, amount: true },
        },
      },
    });

    const inRange = (period: string) =>
      (!fromPeriod || period >= fromPeriod) &&
      (!toPeriod || period <= toPeriod);

    const byPeriod = new Map<
      string,
      { subcontractor: Decimal; supplier: Decimal }
    >();
    const totals = { subcontractor: new Decimal(0), supplier: new Decimal(0) };

    const contractRows = contracts.map((contract) => {
      const bucketKey =
        contract.kind === ContractKind.SUBCONTRACTOR
          ? 'subcontractor'
          : 'supplier';
      let paid = new Decimal(0);
      let paidToDate = new Decimal(0);
      for (const row of contract.collections) {
        paidToDate = paidToDate.add(row.amount);
        if (!inRange(row.period)) continue;
        paid = paid.add(row.amount);
        let bucket = byPeriod.get(row.period);
        if (!bucket) {
          bucket = { subcontractor: new Decimal(0), supplier: new Decimal(0) };
          byPeriod.set(row.period, bucket);
        }
        bucket[bucketKey] = bucket[bucketKey].add(row.amount);
        totals[bucketKey] = totals[bucketKey].add(row.amount);
      }
      return {
        id: contract.id,
        contractNo: contract.contractNo,
        name: contract.name,
        kind: contract.kind,
        status: contract.status,
        contractValue: toDecimalString(contract.contractValue),
        company: contract.company,
        counterparty: contract.counterparty,
        paid: toDecimalString(paid),
        paidToDate: toDecimalString(paidToDate),
        remaining: toDecimalString(
          Decimal.max(new Decimal(contract.contractValue).sub(paidToDate), 0),
        ),
      };
    });

    const points = Array.from(byPeriod.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([period, bucket]) => ({
        period,
        subcontractor: toDecimalString(bucket.subcontractor),
        supplier: toDecimalString(bucket.supplier),
        total: toDecimalString(bucket.subcontractor.add(bucket.supplier)),
      }));

    return {
      fromPeriod: fromPeriod ?? null,
      toPeriod: toPeriod ?? null,
      points,
      totals: {
        subcontractor: toDecimalString(totals.subcontractor),
        supplier: toDecimalString(totals.supplier),
        total: toDecimalString(totals.subcontractor.add(totals.supplier)),
      },
      contracts: contractRows,
    };
  }

  async listPeriods(projectId: string): Promise<string[]> {
    await this.ensureProject(projectId);
    const rows = await this.prisma.projectOperatingCost.findMany({
      where: { projectId },
      distinct: ['period'],
      select: { period: true },
      orderBy: { period: 'desc' },
    });
    return rows.map((r) => r.period);
  }

  async create(projectId: string, dto: CreateProjectOperatingCostDto) {
    await this.ensureProject(projectId);
    const category = await this.resolveCategory(dto);
    return this.prisma.projectOperatingCost.create({
      data: {
        projectId,
        categoryId: category.id,
        period: dto.period,
        title: dto.title,
        amount: dto.amount,
        note: dto.note,
      },
      include: categoryInclude,
    });
  }

  async update(id: string, dto: UpdateProjectOperatingCostDto) {
    const existing = await this.prisma.projectOperatingCost.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`Operating cost ${id} not found`);
    }

    let categoryId = existing.categoryId;
    if (dto.categoryId || dto.categoryCode) {
      const category = await this.resolveCategory(dto);
      categoryId = category.id;
    }

    const { categoryId: _cid, categoryCode: _code, ...rest } = dto;

    return this.prisma.projectOperatingCost.update({
      where: { id },
      data: {
        ...rest,
        categoryId,
      },
      include: categoryInclude,
    });
  }

  async remove(id: string) {
    const row = await this.prisma.projectOperatingCost.findUnique({
      where: { id },
    });
    if (!row) {
      throw new NotFoundException(`Operating cost ${id} not found`);
    }
    return this.prisma.projectOperatingCost.delete({ where: { id } });
  }

  async bulkCreate(projectId: string, dto: BulkProjectOperatingCostDto) {
    await this.ensureProject(projectId);
    if (!dto.items?.length) {
      throw new BadRequestException('Không có dòng chi phí để nhập');
    }

    const results = [];
    for (const [index, item] of dto.items.entries()) {
      const rowNo = index + 1;
      try {
        const row = await this.create(projectId, item);
        results.push(row);
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
          throw new BadRequestException(`Dòng ${rowNo}: ${msg}`);
        }
        throw new BadRequestException(`Dòng ${rowNo}: không lưu được.`);
      }
    }

    return { count: results.length, data: results };
  }
}
