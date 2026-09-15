import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { ContractMonthlyFinancial } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { toDecimalString } from '../../common/utils/decimal.util';
import { CreateMonthlyFinancialDto } from './dto/create-monthly-financial.dto';
import { UpdateMonthlyFinancialDto } from './dto/update-monthly-financial.dto';

@Injectable()
export class MonthlyFinancialsService {
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

  private mapRow(row: ContractMonthlyFinancial) {
    return {
      ...row,
      actualWorkAmount: toDecimalString(row.actualWorkAmount),
    };
  }

  async findByContract(contractId: string) {
    await this.ensureContract(contractId);
    const rows = await this.prisma.contractMonthlyFinancial.findMany({
      where: { contractId },
      orderBy: { period: 'asc' },
    });
    return rows.map((row) => this.mapRow(row));
  }

  async create(contractId: string, dto: CreateMonthlyFinancialDto) {
    await this.ensureContract(contractId);

    const existing = await this.prisma.contractMonthlyFinancial.findUnique({
      where: {
        contractId_period: { contractId, period: dto.period },
      },
    });
    if (existing) {
      throw new ConflictException(
        `Monthly financial record for period "${dto.period}" already exists`,
      );
    }

    const created = await this.prisma.contractMonthlyFinancial.create({
      data: {
        contractId,
        period: dto.period,
        actualWorkAmount: dto.actualWorkAmount ?? 0,
        note: dto.note,
      },
    });

    return this.mapRow(created);
  }

  async update(id: string, dto: UpdateMonthlyFinancialDto) {
    const current = await this.prisma.contractMonthlyFinancial.findUnique({
      where: { id },
    });
    if (!current) {
      throw new NotFoundException(`Monthly financial record ${id} not found`);
    }

    const updated = await this.prisma.contractMonthlyFinancial.update({
      where: { id },
      data: {
        ...(dto.actualWorkAmount !== undefined
          ? { actualWorkAmount: dto.actualWorkAmount }
          : {}),
        ...(dto.note !== undefined ? { note: dto.note } : {}),
      },
    });

    return this.mapRow(updated);
  }

  async remove(id: string) {
    const current = await this.prisma.contractMonthlyFinancial.findUnique({
      where: { id },
    });
    if (!current) {
      throw new NotFoundException(`Monthly financial record ${id} not found`);
    }

    const deleted = await this.prisma.contractMonthlyFinancial.delete({
      where: { id },
    });

    return this.mapRow(deleted);
  }
}
