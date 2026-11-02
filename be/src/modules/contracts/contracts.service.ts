import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ContractKind,
  ContractStatus,
  PartnerType,
  Prisma,
} from '@prisma/client';
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
  DeletedContractConflictAction,
} from './dto/bulk-contract.dto';
import {
  contractTypeFilterWhere,
  normalizeContractTypes,
} from '../../common/contract-type.util';
import {
  CONTRACT_KIND_LABEL,
  isExpenseContractKind,
  REVENUE_CONTRACT_WHERE,
} from '../../common/contract-kind.util';

const contractInclude = {
  project: { select: { id: true, code: true, name: true } },
  company: { select: { id: true, code: true, name: true } },
  counterparty: { select: { id: true, code: true, name: true } },
} as const;

const PARTNER_TYPE_BY_KIND: Record<ContractKind, PartnerType> = {
  INVESTOR: PartnerType.INVESTOR,
  SUBCONTRACTOR: PartnerType.SUBCONTRACTOR,
  SUPPLIER: PartnerType.SUPPLIER,
};

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

  /**
   * HĐ chi (thầu phụ / NCC) bắt buộc có công ty + đối tác đúng loại.
   * HĐ CĐT không lưu đối tác — khách hàng lấy từ dự án.
   */
  private async resolveParties(
    kind: ContractKind,
    companyId: string | null | undefined,
    counterpartyId: string | null | undefined,
  ): Promise<{ companyId: string | null; counterpartyId: string | null }> {
    if (companyId) {
      const company = await this.prisma.company.findFirst({
        where: { id: companyId, deletedAt: null },
      });
      if (!company) {
        throw new NotFoundException('Công ty không tồn tại hoặc đã xóa');
      }
    }

    if (!isExpenseContractKind(kind)) {
      return { companyId: companyId ?? null, counterpartyId: null };
    }

    const label = CONTRACT_KIND_LABEL[kind];
    if (!companyId) {
      throw new BadRequestException(`HĐ ${label} cần chọn công ty ký`);
    }
    if (!counterpartyId) {
      throw new BadRequestException(`HĐ ${label} cần chọn ${label}`);
    }
    const partner = await this.prisma.customer.findFirst({
      where: { id: counterpartyId, deletedAt: null },
    });
    if (!partner) {
      throw new NotFoundException(`${label} không tồn tại hoặc đã xóa`);
    }
    if (!partner.partnerTypes.includes(PARTNER_TYPE_BY_KIND[kind])) {
      throw new BadRequestException(
        `Đối tác "${partner.code}" chưa được đánh dấu là ${label}`,
      );
    }
    return { companyId, counterpartyId };
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

    const kind = dto.kind ?? ContractKind.INVESTOR;
    const parties = await this.resolveParties(
      kind,
      dto.companyId,
      dto.counterpartyId,
    );

    return this.prisma.contract.create({
      data: {
        projectId: dto.projectId,
        kind,
        ...parties,
        contractNo: dto.contractNo,
        name: dto.name,
        contractType: normalizeContractTypes(dto.contractType),
        contractValue: dto.contractValue,
        billingCycle: dto.billingCycle,
        status: dto.status ?? ContractStatus.DRAFT,
        paymentTermDays: dto.paymentTermDays ?? 60,
        durationYears: dto.durationYears ?? undefined,
        note: dto.note,
        signedDate: dto.signedDate ? new Date(dto.signedDate) : undefined,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      },
      include: contractInclude,
    });
  }

  async findAll(query: QueryContractDto): Promise<PaginatedResult<unknown>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;
    const kind = query.kind ?? ContractKind.INVESTOR;

    const where: Prisma.ContractWhereInput = {
      deletedAt: null,
      ...(kind !== 'ALL' ? { kind } : {}),
      ...(query.projectId ? { projectId: query.projectId } : {}),
      ...(query.companyId ? { companyId: query.companyId } : {}),
      ...(query.counterpartyId ? { counterpartyId: query.counterpartyId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.contractType
        ? contractTypeFilterWhere(query.contractType)
        : {}),
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
              {
                counterparty: {
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
        include: contractInclude,
      }),
      this.prisma.contract.count({ where }),
    ]);

    return buildPaginatedResult(data, total, page, limit);
  }

  async findOne(id: string) {
    const contract = await this.prisma.contract.findFirst({
      where: { id, deletedAt: null },
      include: {
        ...contractInclude,
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
    const current = await this.findOne(id);
    this.assertDateRange(dto.startDate, dto.endDate);

    if (dto.kind && dto.kind !== current.kind) {
      throw new BadRequestException(
        'Không đổi được loại hợp đồng (CĐT / thầu phụ / NCC) sau khi tạo',
      );
    }

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

    const { contractType, companyId, counterpartyId, ...rest } = dto;
    const parties =
      companyId !== undefined || counterpartyId !== undefined
        ? await this.resolveParties(
            current.kind,
            companyId !== undefined ? companyId : current.companyId,
            counterpartyId !== undefined
              ? counterpartyId
              : current.counterpartyId,
          )
        : {};

    return this.prisma.contract.update({
      where: { id },
      data: {
        ...rest,
        ...parties,
        ...(contractType !== undefined
          ? { contractType: normalizeContractTypes(contractType) }
          : {}),
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
      include: contractInclude,
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

  private async resolveCompanyIdByCode(code?: string) {
    const value = code?.trim();
    if (!value) return undefined;
    const company = await this.prisma.company.findFirst({
      where: { code: { equals: value, mode: 'insensitive' }, deletedAt: null },
    });
    if (!company) {
      throw new NotFoundException(`Không tìm thấy công ty mã "${value}"`);
    }
    return company.id;
  }

  private async resolveCounterpartyIdByCode(code?: string) {
    const value = code?.trim();
    if (!value) return undefined;
    const partner = await this.prisma.customer.findFirst({
      where: { code: { equals: value, mode: 'insensitive' }, deletedAt: null },
    });
    if (!partner) {
      throw new NotFoundException(`Không tìm thấy đối tác mã "${value}"`);
    }
    return partner.id;
  }

  async bulkUpsert(dto: BulkContractDto) {
    if (!dto.items?.length) {
      throw new BadRequestException('No contract items to upsert');
    }
    const kind = dto.kind ?? ContractKind.INVESTOR;

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

    const softDeletedContracts = await this.prisma.contract.findMany({
      where: {
        contractNo: { in: dto.items.map((item) => item.contractNo) },
        deletedAt: { not: null },
      },
      select: { id: true, contractNo: true },
    });
    const softDeletedByContractNo = new Map(
      softDeletedContracts.map((contract) => [contract.contractNo, contract]),
    );

    if (softDeletedContracts.length > 0 && !dto.deletedConflictAction) {
      throw new ConflictException({
        code: 'DELETED_CONTRACT_CONFLICT',
        message:
          'Một số số hợp đồng trùng với hợp đồng đã xóa. Hãy chọn khôi phục/cập nhật hoặc tạo mới.',
        contractNos: softDeletedContracts.map(
          (contract) => contract.contractNo,
        ),
      });
    }

    for (const item of dto.items) {
      const projectId = await this.resolveProjectIdByCode(item.projectCode);
      const companyId = await this.resolveCompanyIdByCode(item.companyCode);
      const counterpartyId = await this.resolveCounterpartyIdByCode(
        item.counterpartyCode,
      );
      const payload: CreateContractDto = {
        projectId,
        kind,
        companyId,
        counterpartyId,
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
        durationYears: item.durationYears,
      };

      const existing = await this.prisma.contract.findFirst({
        where: { contractNo: item.contractNo, deletedAt: null },
      });

      if (existing) {
        if (existing.kind !== kind) {
          throw new BadRequestException(
            `Số HĐ "${item.contractNo}" đã tồn tại ở nhóm HĐ ${CONTRACT_KIND_LABEL[existing.kind]}`,
          );
        }
        const row = await this.update(existing.id, payload);
        results.push(row);
        updated += 1;
      } else if (softDeletedByContractNo.has(item.contractNo)) {
        const softDeleted = softDeletedByContractNo.get(item.contractNo)!;

        if (
          dto.deletedConflictAction === DeletedContractConflictAction.REPLACE
        ) {
          await this.prisma.contract.delete({ where: { id: softDeleted.id } });
          const row = await this.create(payload);
          results.push(row);
          created += 1;
        } else {
          const parties = await this.resolveParties(
            kind,
            companyId,
            counterpartyId,
          );
          const row = await this.prisma.contract.update({
            where: { id: softDeleted.id },
            data: {
              ...payload,
              ...parties,
              contractType: normalizeContractTypes(payload.contractType),
              signedDate: payload.signedDate
                ? new Date(payload.signedDate)
                : null,
              startDate: payload.startDate ? new Date(payload.startDate) : null,
              endDate: payload.endDate ? new Date(payload.endDate) : null,
              deletedAt: null,
            },
            include: contractInclude,
          });
          results.push(row);
          updated += 1;
        }
      } else {
        const row = await this.create(payload);
        results.push(row);
        created += 1;
      }
    }

    return { count: results.length, created, updated, data: results };
  }

  async getOverviewStatistics() {
    const base = { deletedAt: null, ...REVENUE_CONTRACT_WHERE };
    const [
      customerCount,
      contractCount,
      operationContractCount,
      maintenanceContractCount,
    ] = await Promise.all([
      this.prisma.customer.count({
        where: {
          deletedAt: null,
          partnerTypes: { has: PartnerType.INVESTOR },
        },
      }),
      this.prisma.contract.count({ where: base }),
      this.prisma.contract.count({
        where: { ...base, ...contractTypeFilterWhere('OPERATION') },
      }),
      this.prisma.contract.count({
        where: { ...base, ...contractTypeFilterWhere('MAINTENANCE') },
      }),
    ]);

    return {
      customerCount,
      contractCount,
      operationContractCount,
      maintenanceContractCount,
    };
  }

  /** Danh sách Số HĐ (nhẹ) — đối chiếu trước import nghiệm thu */
  async importLookup() {
    const rows = await this.prisma.contract.findMany({
      where: { deletedAt: null },
      select: {
        contractNo: true,
        kind: true,
        startDate: true,
        durationYears: true,
        billingCycle: true,
        project: { select: { code: true } },
      },
      orderBy: { contractNo: 'asc' },
    });
    return rows.map((r) => ({
      contractNo: r.contractNo,
      kind: r.kind,
      projectCode: r.project?.code ?? null,
      startDate: r.startDate?.toISOString() ?? null,
      durationYears: r.durationYears,
      billingCycle: r.billingCycle,
    }));
  }
}
