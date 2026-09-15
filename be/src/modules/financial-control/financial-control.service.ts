import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AcceptanceStatus, DocumentStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../prisma/prisma.service';
import {
  compareDecimals,
  maxDecimal,
  subtractDecimals,
  sumDecimals,
  toDecimalString,
} from '../../common/utils/decimal.util';
import {
  generatePeriodsBetween,
  formatPeriodLabel,
} from '../../common/utils/period.util';
import { RevenuePlansService } from '../revenue-plans/revenue-plans.service';
import {
  BulkPlanDto,
  DraftEqualSplitDto,
  GeneratePeriodsDto,
} from './dto/bulk-plan.dto';

export type ScheduleStatus = 'ON_TRACK' | 'BEHIND' | 'AHEAD';

export type BottleneckFlag =
  | 'EXECUTION_BEHIND'
  | 'PENDING_ACCEPTANCE'
  | 'OUTSTANDING_RECEIVABLE'
  | 'CONTRACT_BEHIND';

@Injectable()
export class FinancialControlService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly revenuePlansService: RevenuePlansService,
  ) {}

  private async ensureContract(contractId: string) {
    const contract = await this.prisma.contract.findFirst({
      where: { id: contractId, deletedAt: null },
      include: {
        project: { select: { id: true, code: true, name: true } },
      },
    });
    if (!contract) {
      throw new NotFoundException(`Contract ${contractId} not found`);
    }
    return contract;
  }

  private resolveScheduleStatus(cumulativeVariance: Decimal): ScheduleStatus {
    const cmp = compareDecimals(cumulativeVariance, 0);
    if (cmp < 0) return 'BEHIND';
    if (cmp > 0) return 'AHEAD';
    return 'ON_TRACK';
  }

  private resolveBottlenecks(input: {
    planned: Decimal;
    actualWork: Decimal;
    acceptance: Decimal;
    collected: Decimal;
    cumulativeVariance: Decimal;
  }): BottleneckFlag[] {
    const flags: BottleneckFlag[] = [];
    if (compareDecimals(input.actualWork, input.planned) < 0) {
      flags.push('EXECUTION_BEHIND');
    }
    if (compareDecimals(input.actualWork, input.acceptance) > 0) {
      flags.push('PENDING_ACCEPTANCE');
    }
    if (compareDecimals(input.acceptance, input.collected) > 0) {
      flags.push('OUTSTANDING_RECEIVABLE');
    }
    if (compareDecimals(input.cumulativeVariance, 0) < 0) {
      flags.push('CONTRACT_BEHIND');
    }
    return flags;
  }

  private sumByPeriod<T extends { period: string; amount: Decimal }>(
    rows: T[],
  ): Map<string, Decimal> {
    const map = new Map<string, Decimal>();
    for (const row of rows) {
      const current = map.get(row.period) ?? new Decimal(0);
      map.set(row.period, current.add(row.amount));
    }
    return map;
  }

  async getFinancialControl(contractId: string) {
    const contract = await this.ensureContract(contractId);

    const [plans, monthlyFinancials, approvedAcceptances, collections] =
      await Promise.all([
        this.prisma.revenuePlan.findMany({
          where: { contractId },
          orderBy: { period: 'asc' },
        }),
        this.prisma.contractMonthlyFinancial.findMany({
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
      ]);

    const acceptanceByPeriod = this.sumByPeriod(
      approvedAcceptances.map((a) => ({ period: a.period, amount: a.amount })),
    );
    const collectionByPeriod = this.sumByPeriod(
      collections.map((c) => ({ period: c.period, amount: c.amount })),
    );
    const actualWorkByPeriod = new Map(
      monthlyFinancials.map((m) => [m.period, m.actualWorkAmount]),
    );
    const planByPeriod = new Map(plans.map((p) => [p.period, p.plannedAmount]));

    const timelinePeriods =
      contract.startDate && contract.endDate
        ? generatePeriodsBetween(contract.startDate, contract.endDate)
        : [];

    const periods = Array.from(
      new Set<string>([
        ...timelinePeriods,
        ...plans.map((p) => p.period),
        ...monthlyFinancials.map((m) => m.period),
        ...acceptanceByPeriod.keys(),
        ...collectionByPeriod.keys(),
      ]),
    ).sort();

    const now = new Date();
    const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    let cumulativePlanned = new Decimal(0);
    let cumulativeAcceptance = new Decimal(0);
    let cumulativeCollection = new Decimal(0);

    const warnings: string[] = [];
    const totalPlanned = sumDecimals(plans.map((p) => p.plannedAmount));
    const totalActualWork = sumDecimals(
      monthlyFinancials.map((m) => m.actualWorkAmount),
    );
    const totalAccepted = sumDecimals(approvedAcceptances.map((a) => a.amount));
    const totalCollected = sumDecimals(collections.map((c) => c.amount));

    if (compareDecimals(totalAccepted, contract.contractValue) > 0) {
      warnings.push('Tổng nghiệm thu đã duyệt vượt giá trị hợp đồng');
    }
    if (compareDecimals(totalCollected, totalAccepted) > 0) {
      warnings.push('Tổng thu tiền vượt tổng nghiệm thu đã duyệt');
    }

    const rows = periods.map((period, index) => {
      const planned = planByPeriod.get(period) ?? new Decimal(0);
      const actualWork = actualWorkByPeriod.get(period) ?? new Decimal(0);
      const acceptance = acceptanceByPeriod.get(period) ?? new Decimal(0);
      const collected = collectionByPeriod.get(period) ?? new Decimal(0);

      cumulativePlanned = cumulativePlanned.add(planned);
      cumulativeAcceptance = cumulativeAcceptance.add(acceptance);
      cumulativeCollection = cumulativeCollection.add(collected);

      const variance = acceptance.sub(planned);
      const cumulativeVariance = cumulativeAcceptance.sub(cumulativePlanned);
      const remainingAcceptanceRaw = subtractDecimals(
        contract.contractValue,
        cumulativeAcceptance,
      );
      const remainingAcceptance =
        compareDecimals(remainingAcceptanceRaw, 0) < 0
          ? new Decimal(0)
          : remainingAcceptanceRaw;
      const overContractValue =
        compareDecimals(cumulativeAcceptance, contract.contractValue) > 0;
      const remainingCollection = maxDecimal(
        cumulativeAcceptance.sub(cumulativeCollection),
        0,
      );

      const monthlyFinancial = monthlyFinancials.find(
        (m) => m.period === period,
      );
      const revenuePlan = plans.find((p) => p.period === period);

      const scheduleStatus = this.resolveScheduleStatus(cumulativeVariance);
      const bottlenecks = this.resolveBottlenecks({
        planned,
        actualWork,
        acceptance,
        collected,
        cumulativeVariance,
      });

      let timelineStatus: 'PAST' | 'CURRENT' | 'FUTURE' = 'FUTURE';
      if (period < currentPeriod) timelineStatus = 'PAST';
      else if (period === currentPeriod) timelineStatus = 'CURRENT';

      return {
        period,
        periodLabel: formatPeriodLabel(period, index),
        monthlyFinancialId: monthlyFinancial?.id ?? null,
        revenuePlanId: revenuePlan?.id ?? null,
        plannedAmount: toDecimalString(planned),
        actualWorkAmount: toDecimalString(actualWork),
        acceptanceAmount: toDecimalString(acceptance),
        collectedAmount: toDecimalString(collected),
        cumulativePlanned: toDecimalString(cumulativePlanned),
        cumulativeAcceptance: toDecimalString(cumulativeAcceptance),
        cumulativeCollection: toDecimalString(cumulativeCollection),
        remainingAcceptance: overContractValue
          ? 'OVER_CONTRACT_VALUE'
          : toDecimalString(remainingAcceptance),
        remainingCollection: toDecimalString(remainingCollection),
        variance: toDecimalString(variance),
        cumulativeVariance: toDecimalString(cumulativeVariance),
        scheduleStatus,
        bottlenecks,
        timelineStatus,
        note: monthlyFinancial?.note ?? revenuePlan?.note ?? null,
      };
    });

    const remainingAcceptanceRaw = subtractDecimals(
      contract.contractValue,
      totalAccepted,
    );
    const overContractValue =
      compareDecimals(totalAccepted, contract.contractValue) > 0;
    const remainingAcceptance =
      compareDecimals(remainingAcceptanceRaw, 0) < 0
        ? new Decimal(0)
        : remainingAcceptanceRaw;
    const outstandingCollection = maxDecimal(
      subtractDecimals(totalAccepted, totalCollected),
      0,
    );

    const plannedToDate = sumDecimals(
      plans
        .filter((p) => p.period <= currentPeriod)
        .map((p) => p.plannedAmount),
    );
    const positivePlans = plans.filter((p) =>
      compareDecimals(p.plannedAmount, 0) > 0,
    );
    const averageMonthlyPlanned =
      positivePlans.length > 0
        ? sumDecimals(positivePlans.map((p) => p.plannedAmount)).div(
            positivePlans.length,
          )
        : new Decimal(0);
    const currentPlanAmount =
      planByPeriod.get(currentPeriod) ?? averageMonthlyPlanned;
    const acceptanceRate = compareDecimals(contract.contractValue, 0) > 0
      ? totalAccepted.div(contract.contractValue).mul(100)
      : new Decimal(0);
    const scheduleRate = compareDecimals(plannedToDate, 0) > 0
      ? totalAccepted.div(plannedToDate).mul(100)
      : new Decimal(0);
    const scheduleVariance = totalAccepted.sub(plannedToDate);
    const overallScheduleStatus = this.resolveScheduleStatus(scheduleVariance);

    const collectionRate = compareDecimals(totalAccepted, 0) > 0
      ? totalCollected.div(totalAccepted).mul(100)
      : new Decimal(0);

    return {
      contract: {
        id: contract.id,
        contractNo: contract.contractNo,
        name: contract.name,
        contractValue: toDecimalString(contract.contractValue),
        startDate: contract.startDate,
        endDate: contract.endDate,
        status: contract.status,
        project: contract.project,
      },
      summary: {
        contractValue: toDecimalString(contract.contractValue),
        totalPlanned: toDecimalString(totalPlanned),
        totalActualWork: toDecimalString(totalActualWork),
        totalAccepted: toDecimalString(totalAccepted),
        totalCollected: toDecimalString(totalCollected),
        remainingAcceptance: overContractValue
          ? 'OVER_CONTRACT_VALUE'
          : toDecimalString(remainingAcceptance),
        outstandingCollection: toDecimalString(outstandingCollection),
        scheduleVariance: toDecimalString(scheduleVariance),
        scheduleStatus: overallScheduleStatus,
        planMatchesContractValue: totalPlanned.equals(contract.contractValue),
        overContractValue,
        currentPeriod,
        monthlyRequiredAcceptance: toDecimalString(currentPlanAmount),
        averageMonthlyPlanned: toDecimalString(averageMonthlyPlanned),
        acceptanceRatePercent: acceptanceRate.toDecimalPlaces(1).toFixed(1),
        plannedToDate: toDecimalString(plannedToDate),
        scheduleRatePercent: scheduleRate.toDecimalPlaces(1).toFixed(1),
        collectionRatePercent: collectionRate.toDecimalPlaces(1).toFixed(1),
      },
      timeline: {
        startDate: contract.startDate,
        endDate: contract.endDate,
        currentPeriod,
        periods: timelinePeriods,
      },
      rows,
      warnings,
    };
  }

  async generatePeriods(contractId: string, dto: GeneratePeriodsDto) {
    const contract = await this.ensureContract(contractId);

    if (dto.useContractDates !== false) {
      if (!contract.startDate || !contract.endDate) {
        throw new BadRequestException(
          'Contract startDate and endDate are required to generate periods',
        );
      }
      return {
        periods: generatePeriodsBetween(contract.startDate, contract.endDate),
      };
    }

    if (!dto.startPeriod || !dto.endPeriod) {
      throw new BadRequestException(
        'startPeriod and endPeriod are required when useContractDates is false',
      );
    }

    const [startYear, startMonth] = dto.startPeriod.split('-').map(Number);
    const [endYear, endMonth] = dto.endPeriod.split('-').map(Number);
    const startDate = new Date(Date.UTC(startYear, startMonth - 1, 1));
    const endDate = new Date(Date.UTC(endYear, endMonth - 1, 1));

    return { periods: generatePeriodsBetween(startDate, endDate) };
  }

  draftEqualSplit(contractId: string, dto: DraftEqualSplitDto) {
    return this.ensureContract(contractId).then((contract) => {
      const periods = [...dto.periods].sort();
      if (periods.length === 0) {
        throw new BadRequestException('At least one period is required');
      }

      const distributablePeriods = dto.firstPeriodZero
        ? periods.slice(1)
        : periods;

      if (distributablePeriods.length === 0) {
        return {
          items: periods.map((period) => ({
            period,
            plannedAmount: '0',
            note: null,
          })),
          total: '0',
          contractValue: toDecimalString(contract.contractValue),
        };
      }

      const perMonth = new Decimal(contract.contractValue).div(
        distributablePeriods.length,
      );
      const rounded = perMonth.toDecimalPlaces(2, Decimal.ROUND_DOWN);
      let allocated = new Decimal(0);
      const items = periods.map((period, index) => {
        if (dto.firstPeriodZero && index === 0) {
          return { period, plannedAmount: '0', note: null };
        }

        const distributableIndex = dto.firstPeriodZero ? index - 1 : index;
        const isLast = distributableIndex === distributablePeriods.length - 1;
        const amount = isLast
          ? new Decimal(contract.contractValue).sub(allocated)
          : rounded;

        if (!dto.firstPeriodZero || index > 0) {
          allocated = allocated.add(amount);
        }

        return {
          period,
          plannedAmount: toDecimalString(amount),
          note: null,
        };
      });

      const total = sumDecimals(items.map((i) => i.plannedAmount));

      return {
        items,
        total: toDecimalString(total),
        contractValue: toDecimalString(contract.contractValue),
      };
    });
  }

  async bulkUpsertPlans(contractId: string, dto: BulkPlanDto) {
    await this.ensureContract(contractId);

    let items = dto.items ?? [];

    if (dto.generateFromContractDates) {
      const { periods } = await this.generatePeriods(contractId, {
        useContractDates: true,
      });

      if (dto.equalSplit) {
        const draft = await this.draftEqualSplit(contractId, {
          periods,
          firstPeriodZero: dto.firstPeriodZero ?? false,
        });
        items = draft.items.map((item) => ({
          period: item.period,
          plannedAmount: Number(item.plannedAmount),
          note: item.note ?? undefined,
        }));
      } else {
        items = periods.map((period) => ({
          period,
          plannedAmount: 0,
          note: undefined,
        }));
      }
    }

    if (items.length === 0) {
      throw new BadRequestException('No plan items to upsert');
    }

    const results = [];
    for (const item of items) {
      const existing = await this.prisma.revenuePlan.findUnique({
        where: {
          contractId_period: { contractId, period: item.period },
        },
      });

      if (existing) {
        const updated = await this.revenuePlansService.update(existing.id, {
          plannedAmount: item.plannedAmount,
          note: item.note,
        });
        results.push(updated);
      } else {
        const created = await this.revenuePlansService.create(contractId, item);
        results.push(created);
      }
    }

    return { count: results.length, data: results };
  }
}
