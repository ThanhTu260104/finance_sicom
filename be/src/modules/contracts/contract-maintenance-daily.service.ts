import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { contractTypeFilterWhere } from '../../common/contract-type.util';
import { ContractTypeCode } from '../../common/contract-type.util';
import { REVENUE_CONTRACT_WHERE } from '../../common/contract-kind.util';
import { toDecimalString } from '../../common/utils/decimal.util';
import { BulkMaintenanceDailyDto } from './dto/bulk-maintenance-daily.dto';

function daysInMonth(period: string): string[] {
  const [y, m] = period.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const out: string[] = [];
  for (let d = 1; d <= last; d++) {
    out.push(`${period}-${String(d).padStart(2, '0')}`);
  }
  return out;
}

@Injectable()
export class ContractMaintenanceDailyService {
  constructor(private readonly prisma: PrismaService) {}

  async getGrid(period: string) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) {
      throw new BadRequestException('period must be YYYY-MM');
    }
    const workDates = daysInMonth(period);

    const contracts = await this.prisma.contract.findMany({
      where: {
        deletedAt: null,
        ...REVENUE_CONTRACT_WHERE,
        ...contractTypeFilterWhere('MAINTENANCE' as ContractTypeCode),
      },
      orderBy: [{ contractNo: 'asc' }],
      select: {
        id: true,
        contractNo: true,
        name: true,
        status: true,
        project: { select: { code: true, name: true } },
      },
    });

    const entries = await this.prisma.contractMaintenanceDaily.findMany({
      where: {
        workDate: { in: workDates },
        contract: { deletedAt: null },
      },
      select: {
        contractId: true,
        workDate: true,
        amount: true,
      },
    });

    const amounts: Record<string, string> = {};
    for (const row of entries) {
      amounts[`${row.contractId}|${row.workDate}`] = toDecimalString(
        row.amount,
      );
    }

    const rowTotals: Record<string, string> = {};
    for (const c of contracts) {
      let sum = 0;
      for (const d of workDates) {
        const v = amounts[`${c.id}|${d}`];
        if (v) sum += Number(v);
      }
      rowTotals[c.id] = toDecimalString(sum);
    }

    return {
      period,
      workDates,
      contracts,
      amounts,
      rowTotals,
    };
  }

  async bulkUpsert(dto: BulkMaintenanceDailyDto) {
    const allowedDates = new Set(daysInMonth(dto.period));
    for (const item of dto.items) {
      if (!allowedDates.has(item.workDate)) {
        throw new BadRequestException(
          `workDate ${item.workDate} is outside period ${dto.period}`,
        );
      }
    }

    const contractIds = [...new Set(dto.items.map((i) => i.contractId))];
    const validContracts = await this.prisma.contract.findMany({
      where: {
        id: { in: contractIds },
        deletedAt: null,
        ...REVENUE_CONTRACT_WHERE,
        ...contractTypeFilterWhere('MAINTENANCE' as ContractTypeCode),
      },
      select: { id: true },
    });
    const validSet = new Set(validContracts.map((c) => c.id));
    for (const id of contractIds) {
      if (!validSet.has(id)) {
        throw new BadRequestException(
          `Contract ${id} is not an active maintenance contract`,
        );
      }
    }

    await this.prisma.$transaction(
      dto.items.map((item) =>
        this.prisma.contractMaintenanceDaily.upsert({
          where: {
            contractId_workDate: {
              contractId: item.contractId,
              workDate: item.workDate,
            },
          },
          create: {
            contractId: item.contractId,
            workDate: item.workDate,
            amount: item.amount,
            note: item.note,
          },
          update: {
            amount: item.amount,
            ...(item.note !== undefined ? { note: item.note } : {}),
          },
        }),
      ),
    );

    return { count: dto.items.length };
  }
}
