import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AcceptanceStatus, DocumentStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../prisma/prisma.service';
import {
  subtractDecimals,
  sumDecimals,
  toDecimalString,
} from '../../common/utils/decimal.util';
import { CreateRevenuePlanDto } from './dto/create-revenue-plan.dto';
import { UpdateRevenuePlanDto } from './dto/update-revenue-plan.dto';

@Injectable()
export class RevenuePlansService {
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

  async getContractFinance(contractId: string) {
    const contract = await this.ensureContract(contractId);

    const [plans, approvedAcceptances] = await Promise.all([
      this.prisma.revenuePlan.findMany({
        where: { contractId },
        orderBy: { period: 'asc' },
      }),
      this.prisma.acceptance.findMany({
        where: {
          contractId,
          deletedAt: null,
          status: AcceptanceStatus.APPROVED,
          documentStatus: DocumentStatus.SUBMITTED_UNPAID,
        },
      }),
    ]);

    const totalPlanned = sumDecimals(plans.map((p) => p.plannedAmount));
    const totalAccepted = sumDecimals(approvedAcceptances.map((a) => a.amount));
    const remainingRaw = subtractDecimals(contract.contractValue, totalAccepted);
    const overContractValue = remainingRaw.isNegative();
    const remainingAcceptance = overContractValue
      ? new Decimal(0)
      : remainingRaw;

    const now = new Date();
    const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const currentPlan = plans.find((p) => p.period === currentPeriod);
    const positivePlans = plans.filter((p) => p.plannedAmount.gt(0));
    const averageMonthlyPlanned =
      positivePlans.length > 0
        ? sumDecimals(positivePlans.map((p) => p.plannedAmount)).div(
            positivePlans.length,
          )
        : new Decimal(0);
    const monthlyRequiredAcceptance =
      currentPlan?.plannedAmount ?? averageMonthlyPlanned;

    const acceptanceRate = contract.contractValue.gt(0)
      ? totalAccepted.div(contract.contractValue).mul(100)
      : new Decimal(0);

    const plannedToDate = sumDecimals(
      plans
        .filter((p) => p.period <= currentPeriod)
        .map((p) => p.plannedAmount),
    );
    const scheduleRate = plannedToDate.gt(0)
      ? totalAccepted.div(plannedToDate).mul(100)
      : new Decimal(0);
    const scheduleVariance = totalAccepted.sub(plannedToDate);

    const actualByPeriod = new Map<string, Decimal>();
    for (const acceptance of approvedAcceptances) {
      const current = actualByPeriod.get(acceptance.period) ?? new Decimal(0);
      actualByPeriod.set(acceptance.period, current.add(acceptance.amount));
    }

    const periods = new Set<string>([
      ...plans.map((p) => p.period),
      ...actualByPeriod.keys(),
    ]);

    const comparison = Array.from(periods)
      .sort()
      .map((period) => {
        const plan = plans.find((p) => p.period === period);
        const plannedAmount = plan?.plannedAmount ?? new Decimal(0);
        const actualAmount = actualByPeriod.get(period) ?? new Decimal(0);
        const variance = actualAmount.sub(plannedAmount);
        return {
          period,
          plannedAmount: toDecimalString(plannedAmount),
          actualAmount: toDecimalString(actualAmount),
          variance: toDecimalString(variance),
          revenuePlanId: plan?.id ?? null,
          note: plan?.note ?? null,
        };
      });

    return {
      contractValue: toDecimalString(contract.contractValue),
      totalPlanned: toDecimalString(totalPlanned),
      totalAccepted: toDecimalString(totalAccepted),
      remainingAcceptance: overContractValue
        ? 'OVER_CONTRACT_VALUE'
        : toDecimalString(remainingAcceptance),
      overContractValue,
      currentPeriod,
      monthlyRequiredAcceptance: toDecimalString(monthlyRequiredAcceptance),
      averageMonthlyPlanned: toDecimalString(averageMonthlyPlanned),
      acceptanceRatePercent: acceptanceRate.toDecimalPlaces(1).toFixed(1),
      plannedToDate: toDecimalString(plannedToDate),
      scheduleRatePercent: scheduleRate.toDecimalPlaces(1).toFixed(1),
      scheduleVariance: toDecimalString(scheduleVariance),
      planMatchesContractValue: totalPlanned.equals(contract.contractValue),
      comparison,
      data: plans.map((plan) => ({
        ...plan,
        plannedAmount: toDecimalString(plan.plannedAmount),
        actualAmount: toDecimalString(
          actualByPeriod.get(plan.period) ?? new Decimal(0),
        ),
        variance: toDecimalString(
          (actualByPeriod.get(plan.period) ?? new Decimal(0)).sub(
            plan.plannedAmount,
          ),
        ),
      })),
    };
  }

  async findByContract(contractId: string) {
    return this.getContractFinance(contractId);
  }

  async create(contractId: string, dto: CreateRevenuePlanDto) {
    await this.ensureContract(contractId);

    const existing = await this.prisma.revenuePlan.findUnique({
      where: {
        contractId_period: { contractId, period: dto.period },
      },
    });
    if (existing) {
      throw new ConflictException(
        `Revenue plan for period "${dto.period}" already exists`,
      );
    }

    const created = await this.prisma.revenuePlan.create({
      data: {
        contractId,
        period: dto.period,
        plannedAmount: dto.plannedAmount,
        note: dto.note,
      },
    });

    return {
      ...created,
      plannedAmount: toDecimalString(created.plannedAmount),
    };
  }

  async update(id: string, dto: UpdateRevenuePlanDto) {
    const plan = await this.prisma.revenuePlan.findUnique({ where: { id } });
    if (!plan) {
      throw new NotFoundException(`Revenue plan ${id} not found`);
    }

    if (dto.period && dto.period !== plan.period) {
      const existing = await this.prisma.revenuePlan.findUnique({
        where: {
          contractId_period: {
            contractId: plan.contractId,
            period: dto.period,
          },
        },
      });
      if (existing) {
        throw new ConflictException(
          `Revenue plan for period "${dto.period}" already exists`,
        );
      }
    }

    const updated = await this.prisma.revenuePlan.update({
      where: { id },
      data: {
        ...(dto.period !== undefined ? { period: dto.period } : {}),
        ...(dto.plannedAmount !== undefined
          ? { plannedAmount: dto.plannedAmount }
          : {}),
        ...(dto.note !== undefined ? { note: dto.note } : {}),
      },
    });

    return {
      ...updated,
      plannedAmount: toDecimalString(updated.plannedAmount),
    };
  }

  async remove(id: string) {
    const plan = await this.prisma.revenuePlan.findUnique({ where: { id } });
    if (!plan) {
      throw new NotFoundException(`Revenue plan ${id} not found`);
    }

    const deleted = await this.prisma.revenuePlan.delete({ where: { id } });
    return {
      ...deleted,
      plannedAmount: toDecimalString(deleted.plannedAmount),
    };
  }
}
