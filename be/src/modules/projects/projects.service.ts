import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AcceptancePaymentStatus,
  AcceptanceStatus,
  DocumentStatus,
  Prisma,
  ProjectStatus,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../prisma/prisma.service';
import {
  compareDecimals,
  maxDecimal,
  sumDecimals,
  toDecimalString,
} from '../../common/utils/decimal.util';
import { FinancialControlService } from '../financial-control/financial-control.service';
import {
  buildPaginatedResult,
  PaginatedResult,
} from '../../common/dto/pagination-query.dto';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { QueryProjectDto } from './dto/query-project.dto';
import { BulkProjectDto } from './dto/bulk-project.dto';

const DEFAULT_COMPANY_ID = '00000000-0000-4000-8000-000000000001';

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly financialControlService: FinancialControlService,
  ) {}

  private assertDateRange(startDate?: string, endDate?: string) {
    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      throw new BadRequestException(
        'startDate must be less than or equal to endDate',
      );
    }
  }

  async create(dto: CreateProjectDto) {
    this.assertDateRange(dto.startDate, dto.endDate);

    const existing = await this.prisma.project.findFirst({
      where: { code: dto.code, deletedAt: null },
    });
    if (existing) {
      throw new ConflictException(`Project code "${dto.code}" already exists`);
    }

    if (dto.customerId) {
      const customer = await this.prisma.customer.findFirst({
        where: { id: dto.customerId, deletedAt: null },
      });
      if (!customer) {
        throw new NotFoundException(`Customer ${dto.customerId} not found`);
      }
    }

    return this.prisma.project.create({
      data: {
        ...dto,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      },
      include: {
        customer: { select: { id: true, code: true, name: true } },
        _count: { select: { contracts: { where: { deletedAt: null } } } },
      },
    });
  }

  async findAll(query: QueryProjectDto): Promise<PaginatedResult<unknown>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const where: Prisma.ProjectWhereInput = {
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.customerId ? { customerId: query.customerId } : {}),
      ...(query.search
        ? {
            OR: [
              { code: { contains: query.search, mode: 'insensitive' } },
              { name: { contains: query.search, mode: 'insensitive' } },
              { location: { contains: query.search, mode: 'insensitive' } },
              {
                customer: {
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
      'code',
      'name',
      'status',
      'startDate',
      'endDate',
    ];
    const orderByField = allowedSort.includes(sortBy) ? sortBy : 'createdAt';

    const [data, total] = await Promise.all([
      this.prisma.project.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [orderByField]: sortOrder },
        include: {
          customer: { select: { id: true, code: true, name: true } },
          _count: { select: { contracts: { where: { deletedAt: null } } } },
        },
      }),
      this.prisma.project.count({ where }),
    ]);

    return buildPaginatedResult(data, total, page, limit);
  }

  async getFinanceOverview(id: string) {
    const project = await this.findOne(id);
    const contractIds = (project.contracts ?? []).map((c) => c.id);

    const [acceptances, collections] = await Promise.all([
      this.prisma.acceptance.findMany({
        where: { contractId: { in: contractIds }, deletedAt: null },
      }),
      this.prisma.collection.findMany({
        where: { contractId: { in: contractIds }, deletedAt: null },
      }),
    ]);

    const contractValue = sumDecimals(
      (project.contracts ?? []).map((c) => c.contractValue),
    );

    const submittedAcceptances = acceptances.filter(
      (a) =>
        a.status === AcceptanceStatus.APPROVED &&
        a.documentStatus === DocumentStatus.SUBMITTED_UNPAID,
    );
    const totalAccepted = sumDecimals(
      submittedAcceptances.map((a) => a.amount),
    );
    const totalCollected = sumDecimals(collections.map((c) => c.amount));

    const remainingAcceptanceRaw = new Decimal(contractValue).sub(totalAccepted);
    const overContractValue = remainingAcceptanceRaw.isNegative();
    const remainingAcceptance = overContractValue
      ? new Decimal(0)
      : remainingAcceptanceRaw;
    const outstandingCollection = maxDecimal(
      new Decimal(totalAccepted).sub(totalCollected),
      0,
    );

    const acceptedCollected = sumDecimals(
      submittedAcceptances
        .filter((a) => a.paymentStatus === AcceptancePaymentStatus.COLLECTED)
        .map((a) => a.amount),
    );
    const acceptedUnpaid = sumDecimals(
      submittedAcceptances
        .filter(
          (a) =>
            a.paymentStatus === AcceptancePaymentStatus.WAITING_CLIENT_PAYMENT,
        )
        .map((a) => a.amount),
    );
    const notAcceptedAmount = sumDecimals(
      acceptances
        .filter(
          (a) =>
            a.documentStatus === DocumentStatus.NOT_SUBMITTED ||
            a.paymentStatus === AcceptancePaymentStatus.NOT_ACCEPTED,
        )
        .map((a) => a.amount),
    );

    const acceptanceRate = compareDecimals(contractValue, 0) > 0
      ? totalAccepted.div(contractValue).mul(100)
      : new Decimal(0);
    const collectionRate = compareDecimals(totalAccepted, 0) > 0
      ? totalCollected.div(totalAccepted).mul(100)
      : new Decimal(0);

    const contractOverviews = await Promise.all(
      (project.contracts ?? []).map(async (contract) => {
        const fc = await this.financialControlService.getFinancialControl(
          contract.id,
        );
        return {
          contractId: contract.id,
          contractNo: contract.contractNo,
          name: contract.name,
          contractValue: toDecimalString(contract.contractValue),
          status: contract.status,
          summary: fc.summary,
          rows: fc.rows,
          timeline: fc.timeline,
        };
      }),
    );
    const plannedToDate = sumDecimals(
      contractOverviews.map((contract) =>
        new Decimal(contract.summary.plannedToDate ?? 0),
      ),
    );
    const submittedToDate = sumDecimals(
      contractOverviews.map((contract) =>
        new Decimal(contract.summary.submittedToDate ?? 0),
      ),
    );
    const pendingSubmissionToDate = sumDecimals(
      contractOverviews.map((contract) =>
        new Decimal(contract.summary.pendingSubmissionToDate ?? 0),
      ),
    );
    const remainingPlanAfterPending = maxDecimal(
      plannedToDate.sub(submittedToDate).sub(pendingSubmissionToDate),
      0,
    );

    return {
      project: {
        id: project.id,
        code: project.code,
        name: project.name,
      },
      summary: {
        contractCount: contractIds.length,
        totalValue: toDecimalString(contractValue),
        totalAccepted: toDecimalString(totalAccepted),
        totalCollected: toDecimalString(totalCollected),
        remainingAcceptance: overContractValue
          ? 'OVER_CONTRACT_VALUE'
          : toDecimalString(remainingAcceptance),
        outstandingCollection: toDecimalString(outstandingCollection),
        overContractValue,
        acceptanceRatePercent: acceptanceRate.toDecimalPlaces(1).toFixed(1),
        collectionRatePercent: collectionRate.toDecimalPlaces(1).toFixed(1),
        currentPeriod: contractOverviews[0]?.summary.currentPeriod ?? null,
        plannedToDate: toDecimalString(plannedToDate),
        submittedToDate: toDecimalString(submittedToDate),
        pendingSubmissionToDate: toDecimalString(pendingSubmissionToDate),
        remainingPlanAfterPending: toDecimalString(remainingPlanAfterPending),
      },
      statusBreakdown: [
        {
          key: 'COLLECTED',
          label: 'Đã thu tiền',
          amount: toDecimalString(acceptedCollected),
        },
        {
          key: 'WAITING_PAYMENT',
          label: 'Đã nghiệm thu - chưa thu',
          amount: toDecimalString(acceptedUnpaid),
        },
        {
          key: 'NOT_ACCEPTED',
          label: 'Chưa nghiệm thu (chưa nộp HS)',
          amount: toDecimalString(notAcceptedAmount),
        },
        {
          key: 'REMAINING_CONTRACT',
          label: 'Còn lại trên HĐ (chưa ghi nhận đợt)',
          amount: toDecimalString(
            maxDecimal(
              new Decimal(contractValue)
                .sub(totalAccepted)
                .sub(notAcceptedAmount),
              0,
            ),
          ),
        },
      ],
      contracts: contractOverviews,
    };
  }

  async findOne(id: string) {
    const project = await this.prisma.project.findFirst({
      where: { id, deletedAt: null },
      include: {
        customer: true,
        assignments: { orderBy: { createdAt: 'desc' } },
        contracts: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!project) {
      throw new NotFoundException(`Project ${id} not found`);
    }
    return project;
  }

  async update(id: string, dto: UpdateProjectDto) {
    await this.findOne(id);
    this.assertDateRange(dto.startDate, dto.endDate);

    if (dto.code) {
      const existing = await this.prisma.project.findFirst({
        where: { code: dto.code, deletedAt: null, NOT: { id } },
      });
      if (existing) {
        throw new ConflictException(
          `Project code "${dto.code}" already exists`,
        );
      }
    }

    if (dto.customerId) {
      const customer = await this.prisma.customer.findFirst({
        where: { id: dto.customerId, deletedAt: null },
      });
      if (!customer) {
        throw new NotFoundException(`Customer ${dto.customerId} not found`);
      }
    }

    return this.prisma.project.update({
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
      include: {
        customer: { select: { id: true, code: true, name: true } },
        _count: { select: { contracts: { where: { deletedAt: null } } } },
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.project.update({
      where: { id },
      data: { deletedAt: new Date(), status: ProjectStatus.CANCELLED },
    });
  }

  private async resolveCustomerIdByCode(customerCode?: string) {
    if (!customerCode?.trim()) return undefined;
    const customer = await this.prisma.customer.findFirst({
      where: { code: customerCode.trim(), deletedAt: null },
    });
    if (!customer) {
      throw new NotFoundException(
        `Customer code "${customerCode}" not found`,
      );
    }
    return customer.id;
  }

  async bulkUpsert(dto: BulkProjectDto) {
    if (!dto.items?.length) {
      throw new BadRequestException('No project items to upsert');
    }

    const seen = new Set<string>();
    for (const item of dto.items) {
      const key = item.code.trim().toLowerCase();
      if (seen.has(key)) {
        throw new BadRequestException(
          `Duplicate project code in import: "${item.code}"`,
        );
      }
      seen.add(key);
    }

    const results = [];
    let created = 0;
    let updated = 0;

    for (const item of dto.items) {
      const customerId = await this.resolveCustomerIdByCode(item.customerCode);
      const payload: CreateProjectDto = {
        code: item.code,
        name: item.name,
        companyId: DEFAULT_COMPANY_ID,
        customerId,
        projectType: item.projectType,
        location: item.location,
        address: item.address,
        startDate: item.startDate,
        endDate: item.endDate,
        status: item.status,
        description: item.description,
        note: item.note,
      };

      const existing = await this.prisma.project.findFirst({
        where: { code: item.code, deletedAt: null },
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
