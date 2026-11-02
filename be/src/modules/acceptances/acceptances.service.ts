import {
  AcceptancePaymentStatus,
  AcceptanceStatus,
  DocumentStatus,
  type Acceptance,
} from '@prisma/client';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { toDecimalString } from '../../common/utils/decimal.util';
import { CreateAcceptanceDto } from './dto/create-acceptance.dto';
import { UpdateAcceptanceDto } from './dto/update-acceptance.dto';
import { BulkAcceptanceDto } from './dto/bulk-acceptance.dto';
import { AccountingImportDto } from './dto/accounting-import.dto';
import {
  removeAutoCollectionForAcceptance,
  syncAcceptanceCollectionLink,
} from '../../common/utils/acceptance-collection.sync';
import {
  computeAcceptancePaymentAging,
  paymentDueDateFromInvoice,
} from '../../common/utils/acceptance-payment-aging.util';
import {
  parseBatchSequenceFromAcceptanceNo,
  periodFromUtcDate,
} from '../../common/utils/acceptance-batch.util';

function normalizeContractNo(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

@Injectable()
export class AcceptancesService {
  constructor(private readonly prisma: PrismaService) {}

  private async ensureContract(contractId: string) {
    const contract = await this.prisma.contract.findFirst({
      where: { id: contractId, deletedAt: null },
    });
    if (!contract) {
      throw new NotFoundException(`Contract ${contractId} not found`);
    }
    return contract;
  }

  private resolveStatuses(input: {
    documentStatus?: DocumentStatus;
    paymentStatus?: AcceptancePaymentStatus;
    status?: AcceptanceStatus;
  }) {
    const documentStatus = input.documentStatus ?? DocumentStatus.NOT_SUBMITTED;

    let paymentStatus =
      input.paymentStatus ??
      (documentStatus === DocumentStatus.NOT_SUBMITTED
        ? AcceptancePaymentStatus.NOT_ACCEPTED
        : AcceptancePaymentStatus.WAITING_CLIENT_PAYMENT);

    // Chưa nộp hồ sơ = chưa nghiệm thu
    if (documentStatus === DocumentStatus.NOT_SUBMITTED) {
      paymentStatus = AcceptancePaymentStatus.NOT_ACCEPTED;
    } else if (
      paymentStatus === AcceptancePaymentStatus.NOT_ACCEPTED &&
      documentStatus === DocumentStatus.SUBMITTED_UNPAID
    ) {
      paymentStatus = AcceptancePaymentStatus.WAITING_CLIENT_PAYMENT;
    }

    let status = input.status;
    if (!status) {
      if (documentStatus === DocumentStatus.NOT_SUBMITTED) {
        status = AcceptanceStatus.DRAFT;
      } else if (paymentStatus === AcceptancePaymentStatus.COLLECTED) {
        status = AcceptanceStatus.APPROVED;
      } else {
        status = AcceptanceStatus.APPROVED;
      }
    }

    if (documentStatus === DocumentStatus.NOT_SUBMITTED) {
      status = AcceptanceStatus.DRAFT;
    } else if (
      status === AcceptanceStatus.DRAFT &&
      documentStatus === DocumentStatus.SUBMITTED_UNPAID
    ) {
      status = AcceptanceStatus.APPROVED;
    }

    return { documentStatus, paymentStatus, status };
  }

  private mapAcceptance(
    row: Acceptance,
    paymentTermDays: number,
    asOf: Date = new Date(),
  ) {
    const paymentDueDate = paymentDueDateFromInvoice(
      row.invoiceDate,
      paymentTermDays,
    );

    const { agingDays, daysUntilDue } = computeAcceptancePaymentAging(
      row,
      paymentTermDays,
      asOf,
    );

    return {
      ...row,
      amount: toDecimalString(row.amount),
      paymentTermDays,
      paymentDueDate: paymentDueDate?.toISOString() ?? null,
      agingDays,
      daysUntilDue,
    };
  }

  async findByContract(contractId: string) {
    const contract = await this.ensureContract(contractId);
    const rows = await this.prisma.acceptance.findMany({
      where: { contractId, deletedAt: null },
      orderBy: [{ period: 'asc' }, { createdAt: 'desc' }],
    });
    return rows.map((row) => this.mapAcceptance(row, contract.paymentTermDays));
  }

  async findOne(id: string) {
    const row = await this.prisma.acceptance.findFirst({
      where: { id, deletedAt: null },
      include: {
        contract: {
          select: {
            id: true,
            contractNo: true,
            name: true,
            contractValue: true,
            paymentTermDays: true,
          },
        },
      },
    });
    if (!row) {
      throw new NotFoundException(`Acceptance ${id} not found`);
    }
    return {
      ...this.mapAcceptance(row, row.contract.paymentTermDays),
      contract: {
        ...row.contract,
        contractValue: toDecimalString(row.contract.contractValue),
      },
    };
  }

  private async resolveAcceptanceBatchLink(
    contractId: string,
    input: {
      acceptanceNo: string;
      scheduleId?: string | null;
      period: string;
      revenuePlanId?: string | null;
    },
  ) {
    const [plans, schedules] = await Promise.all([
      this.prisma.revenuePlan.findMany({
        where: { contractId },
        orderBy: { batchSequence: 'asc' },
      }),
      this.prisma.acceptanceSchedule.findMany({
        where: { contractId, deletedAt: null },
        orderBy: { sequence: 'asc' },
      }),
    ]);

    const explicitPeriod = input.period?.trim() ?? '';
    const hasExplicitPeriod = /^\d{4}-(0[1-9]|1[0-2])$/.test(explicitPeriod);

    if (input.revenuePlanId) {
      const selected = plans.find((p) => p.id === input.revenuePlanId);
      if (selected) {
        return {
          scheduleId:
            selected.scheduleId ?? input.scheduleId ?? null,
          period: hasExplicitPeriod ? explicitPeriod : selected.period,
        };
      }
    }

    const batch = parseBatchSequenceFromAcceptanceNo(input.acceptanceNo);
    let scheduleId = input.scheduleId ?? null;

    const schedule =
      (scheduleId
        ? schedules.find((s) => s.id === scheduleId)
        : null) ??
      (batch != null
        ? schedules.find((s) => s.sequence === batch)
        : null);

    if (schedule && !scheduleId) {
      scheduleId = schedule.id;
    }

    if (hasExplicitPeriod) {
      if (!scheduleId && batch != null) {
        const planByBatch = plans.find((p) => p.batchSequence === batch);
        if (planByBatch?.scheduleId) scheduleId = planByBatch.scheduleId;
      }
      return { scheduleId, period: explicitPeriod };
    }

    let period = explicitPeriod;
    const planBySchedule = scheduleId
      ? plans.find((p) => p.scheduleId === scheduleId)
      : null;
    const planByBatch =
      batch != null
        ? plans.find((p) => p.batchSequence === batch)
        : null;
    const plan = planBySchedule ?? planByBatch;

    if (plan) {
      period = plan.period;
      if (!scheduleId && plan.scheduleId) {
        scheduleId = plan.scheduleId;
      }
    } else if (schedule?.endPeriod) {
      period = schedule.endPeriod;
    } else if (schedule?.endDate) {
      period = periodFromUtcDate(schedule.endDate);
    }

    return { scheduleId, period };
  }

  async create(contractId: string, dto: CreateAcceptanceDto) {
    await this.ensureContract(contractId);

    const linked = await this.resolveAcceptanceBatchLink(contractId, {
      acceptanceNo: dto.acceptanceNo,
      scheduleId: dto.scheduleId,
      period: dto.period,
      revenuePlanId: dto.revenuePlanId,
    });

    const existing = await this.prisma.acceptance.findFirst({
      where: {
        contractId,
        acceptanceNo: dto.acceptanceNo,
        deletedAt: null,
      },
    });
    if (existing) {
      throw new ConflictException(
        `Acceptance number "${dto.acceptanceNo}" already exists on this contract`,
      );
    }

    const statuses = this.resolveStatuses({
      documentStatus: dto.documentStatus,
      paymentStatus: dto.paymentStatus,
      status: dto.status,
    });

    const created = await this.prisma.acceptance.create({
      data: {
        contractId,
        scheduleId: linked.scheduleId,
        acceptanceNo: dto.acceptanceNo,
        period: linked.period,
        amount: dto.amount,
        note: dto.note,
        invoiceNo: dto.invoiceNo,
        acceptanceDate: dto.acceptanceDate
          ? new Date(dto.acceptanceDate)
          : undefined,
        invoiceDate: dto.invoiceDate ? new Date(dto.invoiceDate) : undefined,
        paymentDate: dto.paymentDate ? new Date(dto.paymentDate) : undefined,
        ...statuses,
      },
    });

    await syncAcceptanceCollectionLink(this.prisma, created);

    const refreshed = await this.prisma.acceptance.findFirstOrThrow({
      where: { id: created.id },
    });
    const contract = await this.ensureContract(contractId);
    return this.mapAcceptance(refreshed, contract.paymentTermDays);
  }

  async update(id: string, dto: UpdateAcceptanceDto) {
    const current = await this.prisma.acceptance.findFirst({
      where: { id, deletedAt: null },
    });
    if (!current) {
      throw new NotFoundException(`Acceptance ${id} not found`);
    }

    if (dto.acceptanceNo && dto.acceptanceNo !== current.acceptanceNo) {
      const existing = await this.prisma.acceptance.findFirst({
        where: {
          contractId: current.contractId,
          acceptanceNo: dto.acceptanceNo,
          deletedAt: null,
          NOT: { id },
        },
      });
      if (existing) {
        throw new ConflictException(
          `Acceptance number "${dto.acceptanceNo}" already exists on this contract`,
        );
      }
    }

    const statuses = this.resolveStatuses({
      documentStatus: dto.documentStatus ?? current.documentStatus,
      paymentStatus: dto.paymentStatus ?? current.paymentStatus,
      status: dto.status ?? current.status,
    });

    const acceptanceNo = dto.acceptanceNo ?? current.acceptanceNo;
    const linked = await this.resolveAcceptanceBatchLink(current.contractId, {
      acceptanceNo,
      scheduleId:
        dto.scheduleId !== undefined ? dto.scheduleId : current.scheduleId,
      period: dto.period ?? current.period,
      revenuePlanId: dto.revenuePlanId,
    });

    const updated = await this.prisma.acceptance.update({
      where: { id },
      data: {
        ...(dto.acceptanceNo !== undefined
          ? { acceptanceNo: dto.acceptanceNo }
          : {}),
        scheduleId: linked.scheduleId,
        period: linked.period,
        ...(dto.amount !== undefined ? { amount: dto.amount } : {}),
        ...(dto.note !== undefined ? { note: dto.note } : {}),
        ...(dto.invoiceNo !== undefined ? { invoiceNo: dto.invoiceNo } : {}),
        ...(dto.acceptanceDate !== undefined
          ? {
              acceptanceDate: dto.acceptanceDate
                ? new Date(dto.acceptanceDate)
                : null,
            }
          : {}),
        ...(dto.invoiceDate !== undefined
          ? {
              invoiceDate: dto.invoiceDate ? new Date(dto.invoiceDate) : null,
            }
          : {}),
        ...(dto.paymentDate !== undefined
          ? {
              paymentDate: dto.paymentDate ? new Date(dto.paymentDate) : null,
            }
          : {}),
        ...statuses,
      },
    });

    await syncAcceptanceCollectionLink(this.prisma, updated);

    const refreshed = await this.prisma.acceptance.findFirstOrThrow({
      where: { id: updated.id },
    });
    const contract = await this.ensureContract(current.contractId);
    return this.mapAcceptance(refreshed, contract.paymentTermDays);
  }

  async remove(id: string) {
    const current = await this.prisma.acceptance.findFirst({
      where: { id, deletedAt: null },
    });
    if (!current) {
      throw new NotFoundException(`Acceptance ${id} not found`);
    }

    const deleted = await this.prisma.acceptance.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        status: AcceptanceStatus.CANCELLED,
      },
    });

    await removeAutoCollectionForAcceptance(this.prisma, deleted);

    const contract = await this.ensureContract(current.contractId);
    return this.mapAcceptance(deleted, contract.paymentTermDays);
  }

  async bulkUpsert(contractId: string, dto: BulkAcceptanceDto) {
    await this.ensureContract(contractId);

    if (!dto.items?.length) {
      throw new BadRequestException('No acceptance items to upsert');
    }

    const seen = new Set<string>();
    for (const item of dto.items) {
      const key = item.acceptanceNo.trim().toLowerCase();
      if (seen.has(key)) {
        throw new BadRequestException(
          `Duplicate acceptanceNo in import: "${item.acceptanceNo}"`,
        );
      }
      seen.add(key);
    }

    const results = [];
    let created = 0;
    let updated = 0;

    for (const item of dto.items) {
      const existing = await this.prisma.acceptance.findFirst({
        where: {
          contractId,
          acceptanceNo: item.acceptanceNo,
          deletedAt: null,
        },
      });

      if (existing) {
        const row = await this.update(existing.id, item);
        results.push(row);
        updated += 1;
      } else {
        const row = await this.create(contractId, item);
        results.push(row);
        created += 1;
      }
    }

    return { count: results.length, created, updated, data: results };
  }

  async importAccounting(dto: AccountingImportDto) {
    let items = dto.items ?? [];
    if (!items.length) {
      throw new BadRequestException('No items to import');
    }

    const onlyNorm = dto.onlyContractNo
      ? normalizeContractNo(dto.onlyContractNo)
      : null;
    if (onlyNorm) {
      items = items.filter(
        (item) => normalizeContractNo(item.contractNo) === onlyNorm,
      );
      if (!items.length) {
        throw new BadRequestException(
          'Không có dòng nào khớp hợp đồng được chọn',
        );
      }
    }

    const contracts = await this.prisma.contract.findMany({
      where: { deletedAt: null },
      include: { project: { select: { code: true } } },
    });
    const contractByNo = new Map<
      string,
      (typeof contracts)[number]
    >();
    for (const c of contracts) {
      contractByNo.set(normalizeContractNo(c.contractNo), c);
    }

    const grouped = new Map<string, BulkAcceptanceDto['items']>();
    const errors: Array<{
      contractNo: string;
      acceptanceNo: string;
      message: string;
    }> = [];
    const warnings: Array<{ contractNo: string; message: string }> = [];
    const seen = new Set<string>();

    for (const item of items) {
      const normNo = normalizeContractNo(item.contractNo);
      const contract = contractByNo.get(normNo);
      if (!contract) {
        errors.push({
          contractNo: item.contractNo,
          acceptanceNo: item.acceptanceNo,
          message: 'Không tìm thấy hợp đồng trong hệ thống',
        });
        continue;
      }

      if (item.projectCode?.trim()) {
        const fromFile = item.projectCode.trim().toLowerCase();
        const inDb = contract.project?.code?.trim().toLowerCase();
        if (inDb && fromFile !== inDb) {
          warnings.push({
            contractNo: item.contractNo,
            message: `Mã dự án file (${item.projectCode}) khác DB (${contract.project?.code})`,
          });
        }
      }

      const dupKey = `${contract.id}|${item.acceptanceNo.trim().toLowerCase()}`;
      if (seen.has(dupKey)) {
        errors.push({
          contractNo: item.contractNo,
          acceptanceNo: item.acceptanceNo,
          message: 'Trùng mã nghiệm thu trong cùng lần import',
        });
        continue;
      }
      seen.add(dupKey);

      const linked = await this.resolveAcceptanceBatchLink(contract.id, {
        acceptanceNo: item.acceptanceNo,
        period: item.period,
      });
      const list = grouped.get(contract.id) ?? [];
      list.push({
        acceptanceNo: item.acceptanceNo,
        period: linked.period,
        scheduleId: linked.scheduleId ?? undefined,
        amount: item.amount,
        acceptanceDate: item.acceptanceDate,
        invoiceNo: item.invoiceNo,
        invoiceDate: item.invoiceDate,
        documentStatus: item.documentStatus,
        paymentStatus: item.paymentStatus,
        note: item.note,
      });
      grouped.set(contract.id, list);
    }

    let created = 0;
    let updated = 0;

    for (const [contractId, bulkItems] of grouped) {
      const result = await this.bulkUpsert(contractId, { items: bulkItems });
      created += result.created;
      updated += result.updated;
    }

    return {
      created,
      updated,
      failed: errors.length,
      errors,
      warnings,
    };
  }
}
