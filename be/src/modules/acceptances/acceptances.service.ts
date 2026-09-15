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
import {
  removeAutoCollectionForAcceptance,
  syncAcceptanceCollectionLink,
} from '../../common/utils/acceptance-collection.sync';

function startOfDay(date: Date) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function diffDays(from: Date, to: Date) {
  const ms = startOfDay(to).getTime() - startOfDay(from).getTime();
  return Math.floor(ms / (24 * 60 * 60 * 1000));
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
    const invoiceDate = row.invoiceDate;
    const paymentDueDate = invoiceDate
      ? addDays(startOfDay(invoiceDate), paymentTermDays)
      : null;

    let agingDays: number | null = null;
    let daysUntilDue: number | null = null;

    if (paymentDueDate) {
      const delta = diffDays(paymentDueDate, asOf);
      if (delta >= 0) {
        agingDays = delta;
        daysUntilDue = 0;
      } else {
        agingDays = 0;
        daysUntilDue = Math.abs(delta);
      }
    }

    // Chưa nộp / chưa nghiệm thu → không tính tuổi nợ thu tiền
    if (
      row.documentStatus === DocumentStatus.NOT_SUBMITTED ||
      row.paymentStatus === AcceptancePaymentStatus.NOT_ACCEPTED
    ) {
      agingDays = null;
      daysUntilDue = null;
    }

    if (row.paymentStatus === AcceptancePaymentStatus.COLLECTED) {
      agingDays = 0;
      daysUntilDue = 0;
    }

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
    return rows.map((row) =>
      this.mapAcceptance(row, contract.paymentTermDays),
    );
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

  async create(contractId: string, dto: CreateAcceptanceDto) {
    await this.ensureContract(contractId);

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
        acceptanceNo: dto.acceptanceNo,
        period: dto.period,
        amount: dto.amount,
        note: dto.note,
        invoiceNo: dto.invoiceNo,
        acceptanceDate: dto.acceptanceDate
          ? new Date(dto.acceptanceDate)
          : undefined,
        invoiceDate: dto.invoiceDate ? new Date(dto.invoiceDate) : undefined,
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

    const updated = await this.prisma.acceptance.update({
      where: { id },
      data: {
        ...(dto.acceptanceNo !== undefined
          ? { acceptanceNo: dto.acceptanceNo }
          : {}),
        ...(dto.period !== undefined ? { period: dto.period } : {}),
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
}
