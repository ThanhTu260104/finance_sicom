import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { derivePeriodFromEndDate } from '../../common/utils/acceptance-batch.util';
import {
  buildAcceptancePlanAggregates,
  sumAcceptanceForPlan,
} from '../../common/utils/acceptance-plan-match.util';
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

    const [plans, approvedAcceptances, collections, monthlyFinancials] =
      await Promise.all([
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
      this.prisma.collection.findMany({
        where: { contractId, deletedAt: null },
      }),
      this.prisma.contractMonthlyFinancial.findMany({
        where: { contractId },
      }),
    ]);

    const totalPlanned = sumDecimals(plans.map((p) => p.plannedAmount));
    const totalAccepted = sumDecimals(approvedAcceptances.map((a) => a.amount));
    const totalCollected = sumDecimals(collections.map((c) => c.amount));
    const outstandingCollection = Decimal.max(
      subtractDecimals(totalAccepted, totalCollected),
      new Decimal(0),
    );
    const remainingRaw = subtractDecimals(
      contract.contractValue,
      totalAccepted,
    );
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

    const acceptanceForMatch = approvedAcceptances.map((a) => ({
      acceptanceNo: a.acceptanceNo,
      period: a.period,
      scheduleId: a.scheduleId,
      amount: a.amount,
      acceptanceDate: a.acceptanceDate,
    }));
    const acceptanceAggregates = buildAcceptancePlanAggregates(
      acceptanceForMatch,
    );

    const workByPeriod = new Map<
      string,
      { amount: Decimal; id: string }
    >();
    for (const row of monthlyFinancials) {
      workByPeriod.set(row.period, {
        amount: row.actualWorkAmount,
        id: row.id,
      });
    }

    const planRows = [...plans].sort((a, b) => {
      if (a.batchSequence != null && b.batchSequence != null) {
        const byBatch = a.batchSequence - b.batchSequence;
        if (byBatch !== 0) return byBatch;
      }
      return a.period.localeCompare(b.period);
    });

    const coveredPeriods = new Set(plans.map((p) => p.period));
    const resolveActualForPlan = (plan: (typeof plans)[number] | undefined) => {
      if (!plan) return new Decimal(0);
      return sumAcceptanceForPlan(
        plan,
        acceptanceAggregates,
        acceptanceForMatch,
        coveredPeriods,
      );
    };

    const comparisonFromPlans = planRows.map((plan) => {
      const actualAmount = resolveActualForPlan(plan);
      const variance = actualAmount.sub(plan.plannedAmount);
      const work = workByPeriod.get(plan.period);
      return {
        period: plan.period,
        batchSequence: plan.batchSequence,
        periodStartDate: plan.periodStartDate?.toISOString() ?? null,
        periodEndDate: plan.periodEndDate?.toISOString() ?? null,
        scheduleId: plan.scheduleId,
        plannedAmount: toDecimalString(plan.plannedAmount),
        actualAmount: toDecimalString(actualAmount),
        variance: toDecimalString(variance),
        actualWorkAmount: toDecimalString(work?.amount ?? new Decimal(0)),
        monthlyFinancialId: work?.id ?? null,
        revenuePlanId: plan.id,
        note: plan.note ?? null,
        plannedAcceptanceDate:
          plan.plannedAcceptanceDate?.toISOString() ?? null,
      };
    });

    const orphanPeriods = [
      ...acceptanceAggregates.byPeriod.keys(),
      ...workByPeriod.keys(),
    ].filter((p) => !coveredPeriods.has(p));

    const comparisonOrphans = Array.from(new Set(orphanPeriods))
      .sort()
      .map((period) => {
        const actualAmount =
          acceptanceAggregates.byPeriod.get(period) ?? new Decimal(0);
        const work = workByPeriod.get(period);
        return {
          period,
          batchSequence: null as number | null,
          periodStartDate: null as string | null,
          periodEndDate: null as string | null,
          scheduleId: null as string | null,
          plannedAmount: '0',
          actualAmount: toDecimalString(actualAmount),
          variance: toDecimalString(actualAmount),
          actualWorkAmount: toDecimalString(work?.amount ?? new Decimal(0)),
          monthlyFinancialId: work?.id ?? null,
          revenuePlanId: null as string | null,
          note: null as string | null,
          plannedAcceptanceDate: null as string | null,
        };
      });

    const comparison = [...comparisonFromPlans, ...comparisonOrphans];

    return {
      contractValue: toDecimalString(contract.contractValue),
      totalPlanned: toDecimalString(totalPlanned),
      totalAccepted: toDecimalString(totalAccepted),
      totalCollected: toDecimalString(totalCollected),
      outstandingCollection: toDecimalString(outstandingCollection),
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
        actualAmount: toDecimalString(resolveActualForPlan(plan)),
        variance: toDecimalString(
          resolveActualForPlan(plan).sub(plan.plannedAmount),
        ),
      })),
    };
  }

  async findByContract(contractId: string) {
    return this.getContractFinance(contractId);
  }

  private resolvePlanPeriod(dto: CreateRevenuePlanDto): string {
    if (dto.period?.trim()) return dto.period.trim();
    if (dto.periodEndDate) {
      return derivePeriodFromEndDate(new Date(dto.periodEndDate));
    }
    throw new BadRequestException(
      'Cần kỳ YYYY-MM hoặc ngày đến (periodEndDate) của đợt NT',
    );
  }

  async create(contractId: string, dto: CreateRevenuePlanDto) {
    await this.ensureContract(contractId);

    const period = this.resolvePlanPeriod(dto);

    const existing = await this.prisma.revenuePlan.findUnique({
      where: {
        contractId_period: { contractId, period },
      },
    });
    if (existing) {
      throw new ConflictException(
        `Revenue plan for period "${period}" already exists`,
      );
    }

    const created = await this.prisma.revenuePlan.create({
      data: {
        contractId,
        period,
        batchSequence: dto.batchSequence,
        periodStartDate: dto.periodStartDate
          ? new Date(dto.periodStartDate)
          : undefined,
        periodEndDate: dto.periodEndDate
          ? new Date(dto.periodEndDate)
          : undefined,
        scheduleId: dto.scheduleId,
        plannedAmount: dto.plannedAmount,
        plannedAcceptanceDate: dto.plannedAcceptanceDate
          ? new Date(dto.plannedAcceptanceDate)
          : undefined,
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

    let nextPeriod = dto.period;
    if (dto.periodEndDate && !dto.period) {
      nextPeriod = derivePeriodFromEndDate(new Date(dto.periodEndDate));
    }

    if (nextPeriod && nextPeriod !== plan.period) {
      const existing = await this.prisma.revenuePlan.findUnique({
        where: {
          contractId_period: {
            contractId: plan.contractId,
            period: nextPeriod,
          },
        },
      });
      if (existing && existing.id !== plan.id) {
        throw new ConflictException(
          `Revenue plan for period "${nextPeriod}" already exists`,
        );
      }
    }

    const updated = await this.prisma.revenuePlan.update({
      where: { id },
      data: {
        ...(nextPeriod !== undefined ? { period: nextPeriod } : {}),
        ...(dto.batchSequence !== undefined
          ? { batchSequence: dto.batchSequence }
          : {}),
        ...(dto.periodStartDate !== undefined
          ? {
              periodStartDate: dto.periodStartDate
                ? new Date(dto.periodStartDate)
                : null,
            }
          : {}),
        ...(dto.periodEndDate !== undefined
          ? {
              periodEndDate: dto.periodEndDate
                ? new Date(dto.periodEndDate)
                : null,
            }
          : {}),
        ...(dto.scheduleId !== undefined
          ? { scheduleId: dto.scheduleId || null }
          : {}),
        ...(dto.plannedAmount !== undefined
          ? { plannedAmount: dto.plannedAmount }
          : {}),
        ...(dto.plannedAcceptanceDate !== undefined
          ? {
              plannedAcceptanceDate: dto.plannedAcceptanceDate
                ? new Date(dto.plannedAcceptanceDate)
                : null,
            }
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
