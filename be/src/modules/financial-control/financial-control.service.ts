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
  splitDecimalEqually,
  subtractDecimals,
  sumDecimals,
  toDecimalString,
} from '../../common/utils/decimal.util';
import {
  generatePeriodsBetween,
  formatPeriodLabel,
} from '../../common/utils/period.util';
import {
  expectedAcceptanceRounds,
  generatePeriodsForRevenuePlanSchedule,
  generatePeriodsInBillingRange,
} from '../../common/contract-acceptance-rounds.util';
import {
  derivePeriodFromEndDate,
  generateAcceptanceBatchWindows,
  generateRevenuePlanWindowsFromContract,
} from '../../common/utils/acceptance-batch.util';
import { planDashboardMonth } from '../../common/utils/plan-dashboard-month.util';
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
        company: { select: { id: true, code: true, name: true } },
        counterparty: { select: { id: true, code: true, name: true } },
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

  private monthOverlapsDateRange(
    period: string,
    start: Date,
    end: Date,
  ): boolean {
    const [y, m] = period.split('-').map(Number);
    const monthStart = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0));
    const monthEnd = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));
    return monthStart <= end && monthEnd >= start;
  }

  private findRevenuePlanForPeriod<
    T extends {
      period: string;
      batchSequence: number | null;
      periodStartDate: Date | null;
      periodEndDate: Date | null;
    },
  >(period: string, planList: T[]): T | undefined {
    const exact = planList.find((p) => p.period === period);
    if (exact) return exact;
    for (const p of planList) {
      if (!p.periodStartDate || !p.periodEndDate) continue;
      if (
        this.monthOverlapsDateRange(period, p.periodStartDate, p.periodEndDate)
      ) {
        return p;
      }
    }
    return undefined;
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

    const [
      plans,
      monthlyFinancials,
      approvedAcceptances,
      pendingSubmissionAcceptances,
      collections,
    ] = await Promise.all([
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
      this.prisma.acceptance.findMany({
        where: {
          contractId,
          deletedAt: null,
          documentStatus: DocumentStatus.NOT_SUBMITTED,
          status: {
            in: [
              AcceptanceStatus.DRAFT,
              AcceptanceStatus.SUBMITTED,
              AcceptanceStatus.APPROVED,
            ],
          },
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

    const acceptanceBatchWindows =
      contract.startDate &&
      contract.durationYears != null &&
      contract.durationYears > 0
        ? generateAcceptanceBatchWindows({
            startDate: contract.startDate,
            durationYears: contract.durationYears,
            billingCycle: contract.billingCycle,
            endDate: contract.endDate,
          })
        : [];

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
      const revenuePlan = this.findRevenuePlanForPeriod(period, plans);
      const batchWindow = acceptanceBatchWindows.find((w) =>
        this.monthOverlapsDateRange(period, w.periodStartDate, w.periodEndDate),
      );
      const batchSequence =
        revenuePlan?.batchSequence ?? batchWindow?.batchSequence ?? null;
      const periodStartDate =
        revenuePlan?.periodStartDate ??
        batchWindow?.periodStartDate ??
        null;
      const periodEndDate =
        revenuePlan?.periodEndDate ?? batchWindow?.periodEndDate ?? null;

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
        batchSequence,
        periodStartDate: periodStartDate?.toISOString() ?? null,
        periodEndDate: periodEndDate?.toISOString() ?? null,
        plannedAcceptanceDate:
          revenuePlan?.plannedAcceptanceDate?.toISOString() ?? null,
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
    const submittedToDate = sumDecimals(
      approvedAcceptances
        .filter((acceptance) => acceptance.period <= currentPeriod)
        .map((acceptance) => acceptance.amount),
    );
    const pendingSubmissionToDate = sumDecimals(
      pendingSubmissionAcceptances
        .filter((acceptance) => acceptance.period <= currentPeriod)
        .map((acceptance) => acceptance.amount),
    );
    const remainingPlanAfterPending = maxDecimal(
      plannedToDate.sub(submittedToDate).sub(pendingSubmissionToDate),
      0,
    );
    const positivePlans = plans.filter(
      (p) => compareDecimals(p.plannedAmount, 0) > 0,
    );
    const averageMonthlyPlanned =
      positivePlans.length > 0
        ? sumDecimals(positivePlans.map((p) => p.plannedAmount)).div(
            positivePlans.length,
          )
        : new Decimal(0);
    const currentPlanAmount =
      planByPeriod.get(currentPeriod) ?? averageMonthlyPlanned;
    const acceptanceRate =
      compareDecimals(contract.contractValue, 0) > 0
        ? totalAccepted.div(contract.contractValue).mul(100)
        : new Decimal(0);
    const scheduleRate =
      compareDecimals(plannedToDate, 0) > 0
        ? submittedToDate.div(plannedToDate).mul(100)
        : new Decimal(0);
    const scheduleVariance = submittedToDate.sub(plannedToDate);
    const overallScheduleStatus = this.resolveScheduleStatus(scheduleVariance);

    const collectionRate =
      compareDecimals(totalAccepted, 0) > 0
        ? totalCollected.div(totalAccepted).mul(100)
        : new Decimal(0);

    return {
      contract: {
        id: contract.id,
        projectId: contract.projectId,
        kind: contract.kind,
        companyId: contract.companyId,
        counterpartyId: contract.counterpartyId,
        company: contract.company,
        counterparty: contract.counterparty,
        contractNo: contract.contractNo,
        name: contract.name,
        contractType: contract.contractType,
        contractValue: toDecimalString(contract.contractValue),
        signedDate: contract.signedDate?.toISOString() ?? null,
        startDate: contract.startDate?.toISOString() ?? null,
        endDate: contract.endDate?.toISOString() ?? null,
        billingCycle: contract.billingCycle,
        status: contract.status,
        paymentTermDays: contract.paymentTermDays,
        durationYears: contract.durationYears,
        note: contract.note,
        createdAt: contract.createdAt.toISOString(),
        updatedAt: contract.updatedAt.toISOString(),
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
        submittedToDate: toDecimalString(submittedToDate),
        pendingSubmissionToDate: toDecimalString(pendingSubmissionToDate),
        remainingPlanAfterPending: toDecimalString(remainingPlanAfterPending),
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

  private periodsFromAcceptanceSchedule(
    contract: Awaited<ReturnType<FinancialControlService['ensureContract']>>,
    range?: { fromPeriod: string; toPeriod: string },
  ) {
    if (range?.fromPeriod && range?.toPeriod) {
      if (!contract.startDate) {
        throw new BadRequestException(
          'Chọn kỳ bắt đầu và kết thúc NT, hoặc nhập ngày bắt đầu HĐ',
        );
      }
      if (contract.durationYears == null || contract.durationYears <= 0) {
        throw new BadRequestException(
          'Chọn kỳ bắt đầu và kết thúc NT, hoặc nhập thời hạn (năm) trên HĐ',
        );
      }
      const periods = generatePeriodsForRevenuePlanSchedule({
        startDate: contract.startDate,
        durationYears: contract.durationYears,
        billingCycle: contract.billingCycle,
        endDate: contract.endDate,
      }).filter(
        (p) => p >= range.fromPeriod && p <= range.toPeriod,
      );
      if (periods.length === 0) {
        throw new BadRequestException(
          'Khoảng kỳ không hợp lệ (từ phải ≤ đến) hoặc không sinh được đợt NT',
        );
      }
      return periods;
    }

    if (!contract.startDate) {
      throw new BadRequestException(
        'Chọn kỳ bắt đầu và kết thúc NT, hoặc nhập ngày bắt đầu HĐ',
      );
    }
    if (contract.durationYears == null || contract.durationYears <= 0) {
      throw new BadRequestException(
        'Chọn kỳ bắt đầu và kết thúc NT, hoặc nhập thời hạn (năm) trên HĐ',
      );
    }
    const periods = generatePeriodsForRevenuePlanSchedule({
      startDate: contract.startDate,
      durationYears: contract.durationYears,
      billingCycle: contract.billingCycle,
      endDate: contract.endDate,
    });
    if (periods.length === 0) {
      throw new BadRequestException(
        'Chu kỳ nghiệm thu (Milestone/Tùy chỉnh) không tự sinh kỳ — chọn khoảng kỳ tay hoặc đổi chu kỳ HĐ',
      );
    }
    return periods;
  }

  async generatePeriods(contractId: string, dto: GeneratePeriodsDto) {
    const contract = await this.ensureContract(contractId);

    if (dto.useAcceptanceSchedule) {
      const range =
        dto.startPeriod && dto.endPeriod
          ? { fromPeriod: dto.startPeriod, toPeriod: dto.endPeriod }
          : undefined;
      const periods = this.periodsFromAcceptanceSchedule(contract, range);
      const acceptanceRounds =
        contract.startDate &&
        contract.durationYears != null &&
        contract.durationYears > 0
          ? new Set(
              generateRevenuePlanWindowsFromContract({
                startDate: contract.startDate,
                durationYears: contract.durationYears,
                billingCycle: contract.billingCycle,
                endDate: contract.endDate,
              })
                .filter(
                  (w) =>
                    !range ||
                    (w.period >= range.fromPeriod &&
                      w.period <= range.toPeriod),
                )
                .map((w) => w.batchSequence),
            ).size
          : periods.length;
      return {
        periods,
        acceptanceRounds,
        contractValue: toDecimalString(contract.contractValue),
      };
    }

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

      const planWindows =
        contract.startDate && contract.durationYears
          ? generateRevenuePlanWindowsFromContract({
              startDate: contract.startDate,
              durationYears: contract.durationYears,
              billingCycle: contract.billingCycle,
              endDate: contract.endDate,
            })
          : [];
      const windowByPlanMonth = new Map(
        planWindows.map((w) => [planDashboardMonth(w), w]),
      );
      const resolvePlanWindow = (period: string, index: number) =>
        windowByPlanMonth.get(period) ??
        planWindows.find((w) => w.period === period) ??
        planWindows[index] ??
        null;

      const periodSet = new Set(periods);
      const byBatch = new Map<number, typeof planWindows>();
      for (const w of planWindows) {
        if (!periodSet.has(w.period)) continue;
        const list = byBatch.get(w.batchSequence) ?? [];
        list.push(w);
        byBatch.set(w.batchSequence, list);
      }
      for (const list of byBatch.values()) {
        list.sort((a, b) => a.period.localeCompare(b.period));
      }
      const amountByPeriod = new Map<string, Decimal>();

      if (byBatch.size === 0) {
        const distributablePeriods = dto.firstPeriodZero
          ? periods.slice(1)
          : periods;
        if (distributablePeriods.length === 0) {
          for (const p of periods) {
            amountByPeriod.set(p, new Decimal(0));
          }
        } else {
          const flat = splitDecimalEqually(
            contract.contractValue,
            distributablePeriods.length,
          );
          distributablePeriods.forEach((p, i) => {
            amountByPeriod.set(p, flat[i] ?? new Decimal(0));
          });
          if (dto.firstPeriodZero && periods.length > 0) {
            amountByPeriod.set(periods[0], new Decimal(0));
          }
        }
      } else {
        const batchOrder = [...byBatch.keys()].sort((a, b) => a - b);
        const distributableBatches =
          dto.firstPeriodZero && batchOrder.length > 0
            ? batchOrder.slice(1)
            : batchOrder;

        const batchTotals = new Map<number, Decimal>();
        if (distributableBatches.length === 0) {
          for (const b of batchOrder) {
            batchTotals.set(b, new Decimal(0));
          }
        } else {
          const batchAmounts = splitDecimalEqually(
            contract.contractValue,
            distributableBatches.length,
          );
          distributableBatches.forEach((b, i) => {
            batchTotals.set(b, batchAmounts[i] ?? new Decimal(0));
          });
          if (dto.firstPeriodZero && batchOrder.length > 0) {
            batchTotals.set(batchOrder[0], new Decimal(0));
          }
        }

        for (const batchSeq of batchOrder) {
          const slices = byBatch.get(batchSeq) ?? [];
          const batchTotal = batchTotals.get(batchSeq) ?? new Decimal(0);
          if (batchTotal.isZero() || slices.length === 0) {
            for (const s of slices) {
              amountByPeriod.set(s.period, new Decimal(0));
            }
            continue;
          }
          const sliceAmounts = splitDecimalEqually(batchTotal, slices.length);
          slices.forEach((s, i) => {
            amountByPeriod.set(s.period, sliceAmounts[i] ?? new Decimal(0));
          });
        }
      }

      const items = periods.map((period, index) => {
        const w = resolvePlanWindow(period, index);
        const amount = amountByPeriod.get(period) ?? new Decimal(0);
        return {
          period,
          batchSequence: w?.batchSequence,
          periodStartDate: w?.periodStartDate?.toISOString(),
          periodEndDate: w?.periodEndDate?.toISOString(),
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
    const contract = await this.ensureContract(contractId);

    if (dto.replaceExisting) {
      await this.prisma.revenuePlan.deleteMany({ where: { contractId } });
    }

    let items = dto.items ?? [];

    if (dto.generateFromAcceptanceSchedule) {
      const range =
        dto.startPeriod && dto.endPeriod
          ? { fromPeriod: dto.startPeriod, toPeriod: dto.endPeriod }
          : undefined;
      const periods = this.periodsFromAcceptanceSchedule(contract, range);
      const draft = await this.draftEqualSplit(contractId, {
        periods,
        firstPeriodZero: dto.firstPeriodZero ?? false,
      });
      items = draft.items.map((item) => ({
        period: item.period,
        batchSequence: item.batchSequence,
        periodStartDate: item.periodStartDate,
        periodEndDate: item.periodEndDate,
        plannedAmount: Number(item.plannedAmount),
        note: item.note ?? undefined,
      }));
    } else if (dto.generateFromContractDates) {
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
          batchSequence: item.batchSequence,
          periodStartDate: item.periodStartDate,
          periodEndDate: item.periodEndDate,
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
      const period =
        item.period ??
        (item.periodEndDate
          ? derivePeriodFromEndDate(new Date(item.periodEndDate))
          : undefined);
      if (!period) {
        throw new BadRequestException(
          'Mỗi dòng kế hoạch cần kỳ hoặc ngày đến (periodEndDate)',
        );
      }
      const existing = await this.prisma.revenuePlan.findUnique({
        where: {
          contractId_period: { contractId, period },
        },
      });

      if (existing) {
        const updated = await this.revenuePlansService.update(existing.id, {
          plannedAmount: item.plannedAmount,
          plannedAcceptanceDate: item.plannedAcceptanceDate,
          batchSequence: item.batchSequence,
          periodStartDate: item.periodStartDate,
          periodEndDate: item.periodEndDate,
          note: item.note,
        });
        results.push(updated);
      } else {
        const created = await this.revenuePlansService.create(contractId, {
          ...item,
          period,
        });
        results.push(created);
      }
    }

    return { count: results.length, data: results };
  }
}
