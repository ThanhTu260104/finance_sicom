import { Injectable, NotFoundException } from '@nestjs/common';
import {
  Acceptance,
  AcceptancePaymentStatus,
  AcceptanceSchedule,
  AcceptanceStatus,
  ContractStatus,
  DocumentStatus,
  Prisma,
  ProjectAssignmentRole,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import {
  compareDecimals,
  maxDecimal,
  sumDecimals,
  toDecimalString,
} from '../../common/utils/decimal.util';
import { PrismaService } from '../../prisma/prisma.service';
import {
  acceptanceBatchWindowsForContract,
  attachBatchMetadataToTrendPoints,
} from '../../common/utils/period-batch-metadata.util';
import {
  buildContractBatchTrend,
  mergeContractBatchTrends,
  createContractBatchResolver,
  type ContractBatchResolver,
} from '../../common/utils/contract-batch-trend.util';
import { acceptanceOccurrencePeriod } from '../../common/utils/acceptance-reporting-period.util';
import { collectionOccurrencePeriod } from '../../common/utils/collection-reporting-period.util';
import {
  planDashboardMonthForBillingCycle,
  planMatchesDashboardMonth,
} from '../../common/utils/plan-dashboard-month.util';
import {
  buildAcceptancePlanAggregates,
  subBatchIndexForPlan,
  sumAcceptanceForPlan,
} from '../../common/utils/acceptance-plan-match.util';
import { listOverdueUnacceptedAcceptanceBatches } from '../../common/utils/overdue-acceptance-batch.util';
import {
  addToPeriodMap,
  buildContractWhere,
  contractTimeProgressPercent,
  EXPIRING_CONTRACT_WARN_DAYS,
  isExpiringSoon,
  listPeriodsInclusive,
  shiftPeriodMonths,
  pctOfValue,
  resolveContractChartPeriodRange,
  resolveDashboardClock,
  resolveProjectChartPeriodRange,
  resolveTrendPeriodRange,
  sumMapForPeriod,
  sumMapUpToPeriod,
} from './dashboard-aggregation.helpers';
import { DashboardOverviewQueryDto } from './dto/dashboard-overview-query.dto';
import {
  DashboardTimelineQueryDto,
  TimelineSortField,
} from './dto/dashboard-timeline-query.dto';
import { buildContractRoundStats } from './contract-round-stats.helper';
import {
  computeAcceptancePaymentAging,
  mergeWorstAcceptancePaymentAging,
  type AcceptancePaymentAging,
} from '../../common/utils/acceptance-payment-aging.util';

const ACCEPTANCE_WHERE: Prisma.AcceptanceWhereInput = {
  deletedAt: null,
  status: AcceptanceStatus.APPROVED,
  documentStatus: DocumentStatus.SUBMITTED_UNPAID,
};

type ContractRow = Prisma.ContractGetPayload<{
  include: {
    project: {
      select: {
        id: true;
        code: true;
        name: true;
        customer: { select: { id: true; code: true; name: true } };
        assignments: {
          where: { role: typeof ProjectAssignmentRole.PROJECT_MANAGER };
          take: 1;
          select: { note: true };
        };
      };
    };
  };
}>;

type PeriodMaps = {
  plannedAcceptanceByPeriod: Map<string, Decimal>;
  /** NT theo ngày NT / hóa đơn (biểu đồ mặc định) */
  actualAcceptanceByOccurrencePeriod: Map<string, Decimal>;
  /** NT theo kỳ KH (acceptance.period) */
  actualAcceptanceByPlanPeriod: Map<string, Decimal>;
  actualCollectionByOccurrencePeriod: Map<string, Decimal>;
  actualCollectionByPlanPeriod: Map<string, Decimal>;
  actualWorkByPeriod: Map<string, Decimal>;
  operatingCostByPeriod: Map<string, Decimal>;
};

@Injectable()
export class DashboardAggregationService {
  constructor(private readonly prisma: PrismaService) {}

  private async loadScope(
    query: DashboardOverviewQueryDto,
    restrictContractIds?: string[],
  ) {
    const clock = resolveDashboardClock();
    const contractWhere: Prisma.ContractWhereInput = {
      ...buildContractWhere(query),
      ...(restrictContractIds?.length
        ? { id: { in: restrictContractIds } }
        : {}),
    };

    const contracts = await this.prisma.contract.findMany({
      where: contractWhere,
      include: {
        project: {
          select: {
            id: true,
            code: true,
            name: true,
            customer: { select: { id: true, code: true, name: true } },
            assignments: {
              where: { role: ProjectAssignmentRole.PROJECT_MANAGER },
              take: 1,
              select: { note: true },
            },
          },
        },
      },
    });

    const contractIds = contracts.map((c) => c.id);
    if (contractIds.length === 0) {
      return {
        clock,
        contracts: [] as ContractRow[],
        plans: [],
        acceptances: [],
        collections: [],
        operatingCosts: [] as {
          projectId: string;
          period: string;
          amount: Decimal;
        }[],
        monthlyFinancials: [] as {
          contractId: string;
          period: string;
          actualWorkAmount: Decimal;
        }[],
      };
    }

    const projectIds = [
      ...new Set(contracts.map((c) => c.projectId)),
    ];

    const [plans, acceptances, collections, operatingCosts, monthlyFinancials] =
      await Promise.all([
      this.prisma.revenuePlan.findMany({
        where: { contractId: { in: contractIds } },
      }),
      this.prisma.acceptance.findMany({
        where: { ...ACCEPTANCE_WHERE, contractId: { in: contractIds } },
      }),
      this.prisma.collection.findMany({
        where: { contractId: { in: contractIds }, deletedAt: null },
      }),
      projectIds.length
        ? this.prisma.projectOperatingCost.findMany({
            where: { projectId: { in: projectIds } },
            select: { projectId: true, period: true, amount: true },
          })
        : Promise.resolve([]),
      this.prisma.contractMonthlyFinancial.findMany({
        where: { contractId: { in: contractIds } },
        select: {
          contractId: true,
          period: true,
          actualWorkAmount: true,
        },
      }),
    ]);

    return {
      clock,
      contracts,
      plans,
      acceptances,
      collections,
      operatingCosts,
      monthlyFinancials,
    };
  }

  /** Biểu đồ theo đợt của một HĐ (dữ liệu trong scope) */
  private contractBatchTrend(
    contract: ContractRow,
    scope: Awaited<ReturnType<typeof this.loadScope>>,
    allAcceptances?: Array<{
      id: string;
      acceptanceNo: string;
      period: string;
    }>,
  ) {
    const ofContract = <T extends { contractId: string }>(rows: T[]) =>
      rows.filter((r) => r.contractId === contract.id);
    const acceptances = ofContract(scope.acceptances);
    return buildContractBatchTrend({
      plans: ofContract(scope.plans),
      windows: acceptanceBatchWindowsForContract({
        startDate: contract.startDate,
        durationYears: contract.durationYears,
        billingCycle: contract.billingCycle,
        endDate: contract.endDate,
      }),
      acceptances,
      allAcceptances: allAcceptances ?? acceptances,
      collections: ofContract(scope.collections),
      monthlyFinancials: ofContract(scope.monthlyFinancials),
      now: scope.clock.now,
    });
  }

  /** Bộ gán đợt cho từng HĐ — mọi chu kỳ (HĐ không xác định được đợt: không có) */
  private buildBatchResolvers(
    scope: Awaited<ReturnType<typeof this.loadScope>>,
  ): Map<string, ContractBatchResolver> {
    const out = new Map<string, ContractBatchResolver>();
    for (const contract of scope.contracts) {
      const resolver = createContractBatchResolver({
        plans: scope.plans.filter((p) => p.contractId === contract.id),
        windows: acceptanceBatchWindowsForContract({
          startDate: contract.startDate,
          durationYears: contract.durationYears,
          billingCycle: contract.billingCycle,
          endDate: contract.endDate,
        }),
        acceptances: scope.acceptances.filter(
          (a) => a.contractId === contract.id,
        ),
      });
      if (resolver) out.set(contract.id, resolver);
    }
    return out;
  }

  private buildPeriodMaps(
    scope: Awaited<ReturnType<typeof this.loadScope>>,
  ): PeriodMaps {
    const contractById = new Map(scope.contracts.map((c) => [c.id, c]));
    const batchResolvers = this.buildBatchResolvers(scope);
    // Số thực tế (NT, thu, thực hiện) đã xảy ra: tháng kết thúc đợt nhưng không vượt tháng hiện tại
    const actualMonth = (period: string) =>
      period > scope.clock.currentPeriod ? scope.clock.currentPeriod : period;
    const plannedAcceptanceByPeriod = new Map<string, Decimal>();
    for (const plan of scope.plans) {
      const contract = contractById.get(plan.contractId);
      const resolver = batchResolvers.get(plan.contractId);
      const dashboardMonth = resolver
        ? resolver.endPeriodOf(resolver.forPlan(plan))
        : contract
          ? planDashboardMonthForBillingCycle(plan, contract.billingCycle)
          : plan.period;
      addToPeriodMap(
        plannedAcceptanceByPeriod,
        dashboardMonth,
        plan.plannedAmount,
      );
    }

    // HĐ chu kỳ > 1 tháng: cả đợt (KH, NT, thu, thực hiện) dồn vào tháng kết thúc đợt,
    // NT theo đợt đã chọn khi nghiệm thu — không theo ngày NT
    const actualAcceptanceByOccurrencePeriod = new Map<string, Decimal>();
    const actualAcceptanceByPlanPeriod = new Map<string, Decimal>();
    for (const row of scope.acceptances) {
      const resolver = batchResolvers.get(row.contractId);
      const batchMonth = resolver
        ? actualMonth(resolver.endPeriodOf(resolver.forAcceptance(row)))
        : null;
      const occurrence =
        batchMonth ??
        acceptanceOccurrencePeriod({
          acceptanceDate: row.acceptanceDate,
          invoiceDate: row.invoiceDate,
          period: row.period,
        });
      addToPeriodMap(
        actualAcceptanceByOccurrencePeriod,
        occurrence,
        row.amount,
      );
      addToPeriodMap(
        actualAcceptanceByPlanPeriod,
        batchMonth ?? row.period,
        row.amount,
      );
    }

    const actualCollectionByOccurrencePeriod = new Map<string, Decimal>();
    const actualCollectionByPlanPeriod = new Map<string, Decimal>();
    for (const row of scope.collections) {
      const resolver = batchResolvers.get(row.contractId);
      const batchMonth = resolver
        ? actualMonth(resolver.endPeriodOf(resolver.forCollection(row)))
        : null;
      const occurrence =
        batchMonth ??
        collectionOccurrencePeriod({
          collectionDate: row.collectionDate,
          period: row.period,
        });
      addToPeriodMap(
        actualCollectionByOccurrencePeriod,
        occurrence,
        row.amount,
      );
      addToPeriodMap(
        actualCollectionByPlanPeriod,
        batchMonth ?? row.period,
        row.amount,
      );
    }

    const actualWorkByPeriod = new Map<string, Decimal>();
    for (const row of scope.monthlyFinancials) {
      const resolver = batchResolvers.get(row.contractId);
      addToPeriodMap(
        actualWorkByPeriod,
        resolver
          ? actualMonth(resolver.endPeriodOf(resolver.forPeriod(row.period)))
          : row.period,
        row.actualWorkAmount,
      );
    }

    const operatingCostByPeriod = new Map<string, Decimal>();
    for (const row of scope.operatingCosts) {
      addToPeriodMap(operatingCostByPeriod, row.period, row.amount);
    }

    return {
      plannedAcceptanceByPeriod,
      actualAcceptanceByOccurrencePeriod,
      actualAcceptanceByPlanPeriod,
      actualCollectionByOccurrencePeriod,
      actualCollectionByPlanPeriod,
      actualWorkByPeriod,
      operatingCostByPeriod,
    };
  }

  private periodKeysFromMaps(maps: PeriodMaps): string[] {
    return Array.from(
      new Set([
        ...maps.plannedAcceptanceByPeriod.keys(),
        ...maps.actualAcceptanceByOccurrencePeriod.keys(),
        ...maps.actualAcceptanceByPlanPeriod.keys(),
        ...maps.actualCollectionByOccurrencePeriod.keys(),
        ...maps.actualCollectionByPlanPeriod.keys(),
        ...maps.actualWorkByPeriod.keys(),
        ...maps.operatingCostByPeriod.keys(),
      ]),
    ).sort();
  }

  private buildCumulativeTrend(
    maps: PeriodMaps,
    query: DashboardOverviewQueryDto,
    currentPeriod: string,
    options?: { includeOperatingCost?: boolean },
  ) {
    const includeOperatingCost = options?.includeOperatingCost !== false;
    const periodKeys = Array.from(
      new Set([
        ...maps.plannedAcceptanceByPeriod.keys(),
        ...maps.actualAcceptanceByOccurrencePeriod.keys(),
        ...maps.actualAcceptanceByPlanPeriod.keys(),
        ...maps.actualCollectionByOccurrencePeriod.keys(),
        ...maps.actualCollectionByPlanPeriod.keys(),
        ...maps.actualWorkByPeriod.keys(),
        ...(includeOperatingCost
          ? maps.operatingCostByPeriod.keys()
          : []),
      ]),
    ).sort();

    const { fromPeriod, toPeriod } = resolveTrendPeriodRange({
      query,
      currentPeriod,
      periodKeys,
    });

    const periods = listPeriodsInclusive(fromPeriod, toPeriod);

    let cumPlanned = new Decimal(0);
    let cumActual = new Decimal(0);
    let cumActualPlanPeriod = new Decimal(0);
    let cumCollected = new Decimal(0);
    let cumCollectedPlanPeriod = new Decimal(0);
    let cumActualWork = new Decimal(0);
    let cumOperatingCost = new Decimal(0);

    return periods.map((period) => {
      const plannedAcceptance =
        maps.plannedAcceptanceByPeriod.get(period) ?? new Decimal(0);
      const actualAcceptance =
        maps.actualAcceptanceByOccurrencePeriod.get(period) ??
        new Decimal(0);
      const actualAcceptancePlanPeriod =
        maps.actualAcceptanceByPlanPeriod.get(period) ?? new Decimal(0);
      const actualCollection =
        maps.actualCollectionByOccurrencePeriod.get(period) ??
        new Decimal(0);
      const actualCollectionPlanPeriod =
        maps.actualCollectionByPlanPeriod.get(period) ?? new Decimal(0);
      const actualWork =
        maps.actualWorkByPeriod.get(period) ?? new Decimal(0);
      const operatingCost = includeOperatingCost
        ? (maps.operatingCostByPeriod.get(period) ?? new Decimal(0))
        : new Decimal(0);

      cumPlanned = cumPlanned.add(plannedAcceptance);
      cumActual = cumActual.add(actualAcceptance);
      cumActualPlanPeriod = cumActualPlanPeriod.add(actualAcceptancePlanPeriod);
      cumCollected = cumCollected.add(actualCollection);
      cumCollectedPlanPeriod = cumCollectedPlanPeriod.add(
        actualCollectionPlanPeriod,
      );
      cumActualWork = cumActualWork.add(actualWork);
      if (includeOperatingCost) {
        cumOperatingCost = cumOperatingCost.add(operatingCost);
      }

      const acceptanceGapPeriod = plannedAcceptance.sub(actualAcceptance);
      const acceptanceGapCumulative = cumPlanned.sub(cumActual);

      return {
        period,
        plannedAcceptance: toDecimalString(plannedAcceptance),
        plannedAcceptanceCumulative: toDecimalString(cumPlanned),
        actualAcceptance: toDecimalString(actualAcceptance),
        actualAcceptanceCumulative: toDecimalString(cumActual),
        actualAcceptancePlanPeriod: toDecimalString(actualAcceptancePlanPeriod),
        actualAcceptancePlanPeriodCumulative: toDecimalString(
          cumActualPlanPeriod,
        ),
        actualCollection: toDecimalString(actualCollection),
        actualCollectionCumulative: toDecimalString(cumCollected),
        actualCollectionPlanPeriod: toDecimalString(actualCollectionPlanPeriod),
        actualCollectionPlanPeriodCumulative: toDecimalString(
          cumCollectedPlanPeriod,
        ),
        actualWork: toDecimalString(actualWork),
        actualWorkCumulative: toDecimalString(cumActualWork),
        operatingCost: toDecimalString(operatingCost),
        operatingCostCumulative: toDecimalString(cumOperatingCost),
        acceptanceGap: toDecimalString(acceptanceGapCumulative),
        acceptanceGapPeriod: toDecimalString(acceptanceGapPeriod),
        acceptanceProgressPeriod: pctOfValue(
          actualAcceptance,
          plannedAcceptance,
        ),
      };
    });
  }

  private contractMetrics(
    contract: ContractRow,
    scope: Awaited<ReturnType<typeof this.loadScope>>,
    currentPeriod: string,
    todayUtc: Date,
  ) {
    const contractPlans = scope.plans.filter(
      (p) => p.contractId === contract.id,
    );

    const plannedAcceptanceToDate = sumDecimals(
      contractPlans
        .filter((p) => p.period <= currentPeriod)
        .map((p) => p.plannedAmount),
    );

    const actualAcceptanceToDate = sumDecimals(
      scope.acceptances
        .filter((a) => {
          if (a.contractId !== contract.id) return false;
          const occurrence = acceptanceOccurrencePeriod({
            acceptanceDate: a.acceptanceDate,
            invoiceDate: a.invoiceDate,
            period: a.period,
          });
          return occurrence <= currentPeriod;
        })
        .map((a) => a.amount),
    );

    const actualCollectionToDate = sumDecimals(
      scope.collections
        .filter((c) => {
          if (c.contractId !== contract.id) return false;
          const occurrence = collectionOccurrencePeriod({
            collectionDate: c.collectionDate,
            period: c.period,
          });
          return occurrence <= currentPeriod;
        })
        .map((c) => c.amount),
    );

    const totalCollected = sumDecimals(
      scope.collections
        .filter((c) => c.contractId === contract.id)
        .map((c) => c.amount),
    );

    const plannedAcceptanceCurrentPeriod = sumDecimals(
      contractPlans
        .filter((p) => p.period === currentPeriod)
        .map((p) => p.plannedAmount),
    );
    const actualAcceptanceCurrentPeriod = sumDecimals(
      scope.acceptances
        .filter((a) => {
          if (a.contractId !== contract.id) return false;
          const occurrence = acceptanceOccurrencePeriod({
            acceptanceDate: a.acceptanceDate,
            invoiceDate: a.invoiceDate,
            period: a.period,
          });
          return occurrence === currentPeriod;
        })
        .map((a) => a.amount),
    );
    const actualCollectionCurrentPeriod = sumDecimals(
      scope.collections
        .filter((c) => {
          if (c.contractId !== contract.id) return false;
          const occurrence = collectionOccurrencePeriod({
            collectionDate: c.collectionDate,
            period: c.period,
          });
          return occurrence === currentPeriod;
        })
        .map((c) => c.amount),
    );

    const value = new Decimal(contract.contractValue);
    const acceptanceGap = plannedAcceptanceToDate.sub(actualAcceptanceToDate);

    return {
      contractValue: value,
      plannedAcceptanceToDate,
      actualAcceptanceToDate,
      actualCollectionToDate,
      totalCollected,
      acceptanceGap,
      plannedAcceptanceCurrentPeriod,
      actualAcceptanceCurrentPeriod,
      actualCollectionCurrentPeriod,
      acceptancePercent: pctOfValue(actualAcceptanceToDate, value),
      collectionPercent: pctOfValue(actualCollectionToDate, value),
      timeProgressPercent: contractTimeProgressPercent(
        contract.startDate,
        contract.endDate,
        todayUtc,
      ),
    };
  }

  private resolveKpiPeriod(
    kpiPeriod: string | undefined,
    currentPeriod: string,
  ): string {
    if (kpiPeriod && /^\d{4}-(0[1-9]|1[0-2])$/.test(kpiPeriod)) {
      return kpiPeriod;
    }
    return currentPeriod;
  }

  private buildSummary(
    scope: Awaited<ReturnType<typeof this.loadScope>>,
    maps: PeriodMaps,
    kpiPeriodInput?: string,
  ) {
    const { currentPeriod, asOf, todayUtc } = scope.clock;
    const kpiPeriod = this.resolveKpiPeriod(kpiPeriodInput, currentPeriod);

    const contractValue = sumDecimals(
      scope.contracts.map((c) => c.contractValue),
    );
    const plannedToDate = sumMapUpToPeriod(
      maps.plannedAcceptanceByPeriod,
      kpiPeriod,
    );
    const acceptedToDate = sumMapUpToPeriod(
      maps.actualAcceptanceByOccurrencePeriod,
      kpiPeriod,
    );
    const collectedToDate = sumMapUpToPeriod(
      maps.actualCollectionByOccurrencePeriod,
      kpiPeriod,
    );
    const plannedInCurrentPeriod = sumMapForPeriod(
      maps.plannedAcceptanceByPeriod,
      kpiPeriod,
    );
    const acceptedInCurrentPeriod = sumMapForPeriod(
      maps.actualAcceptanceByOccurrencePeriod,
      kpiPeriod,
    );
    const collectedInCurrentPeriod = sumMapForPeriod(
      maps.actualCollectionByOccurrencePeriod,
      kpiPeriod,
    );
    const operatingCostInCurrentPeriod = sumMapForPeriod(
      maps.operatingCostByPeriod,
      kpiPeriod,
    );
    const operatingCostToDate = sumMapUpToPeriod(
      maps.operatingCostByPeriod,
      kpiPeriod,
    );
    const acceptanceGapPeriod = plannedInCurrentPeriod.sub(
      acceptedInCurrentPeriod,
    );

    const totalCollected = sumDecimals(scope.collections.map((c) => c.amount));

    const activeContractCount = scope.contracts.filter(
      (c) => c.status === ContractStatus.ACTIVE,
    ).length;

    const expiringSoonCount = scope.contracts.filter((c) =>
      isExpiringSoon(c.status, c.endDate, todayUtc, EXPIRING_CONTRACT_WARN_DAYS),
    ).length;

    const projectIds = new Set(scope.contracts.map((c) => c.projectId));

    return {
      contractValue: toDecimalString(contractValue),
      plannedToDate: toDecimalString(plannedToDate),
      acceptedToDate: toDecimalString(acceptedToDate),
      acceptanceGap: toDecimalString(plannedToDate.sub(acceptedToDate)),
      acceptanceGapPeriod: toDecimalString(acceptanceGapPeriod),
      kpiPeriod,
      plannedInCurrentPeriod: toDecimalString(plannedInCurrentPeriod),
      acceptedInCurrentPeriod: toDecimalString(acceptedInCurrentPeriod),
      collectedInCurrentPeriod: toDecimalString(collectedInCurrentPeriod),
      operatingCostInCurrentPeriod: toDecimalString(
        operatingCostInCurrentPeriod,
      ),
      operatingCostToDate: toDecimalString(operatingCostToDate),
      collectedToDate: toDecimalString(collectedToDate),
      totalCollected: toDecimalString(totalCollected),
      acceptanceProgressPercent: pctOfValue(acceptedToDate, contractValue),
      collectionProgressPercent: pctOfValue(collectedToDate, contractValue),
      contractCount: scope.contracts.length,
      activeContractCount,
      expiringSoonCount,
      projectCount: projectIds.size,
      currentPeriod,
      asOf,
    };
  }

  private buildByProject(
    scope: Awaited<ReturnType<typeof this.loadScope>>,
    maps: PeriodMaps,
  ) {
    const { currentPeriod, todayUtc } = scope.clock;
    const projectMap = new Map<
      string,
      {
        projectId: string;
        projectCode: string;
        projectName: string;
        customerName: string | null;
        contractValue: Decimal;
        plannedAcceptanceToDate: Decimal;
        actualAcceptanceToDate: Decimal;
        actualCollectionToDate: Decimal;
        plannedAcceptanceCurrentPeriod: Decimal;
        actualAcceptanceCurrentPeriod: Decimal;
        contractCount: number;
        startDate: Date | null;
        endDate: Date | null;
      }
    >();

    for (const contract of scope.contracts) {
      const key = contract.project.id;
      const m = this.contractMetrics(
        contract,
        scope,
        currentPeriod,
        todayUtc,
      );
      const current = projectMap.get(key) ?? {
        projectId: contract.project.id,
        projectCode: contract.project.code,
        projectName: contract.project.name,
        customerName: contract.project.customer?.name ?? null,
        contractValue: new Decimal(0),
        plannedAcceptanceToDate: new Decimal(0),
        actualAcceptanceToDate: new Decimal(0),
        actualCollectionToDate: new Decimal(0),
        plannedAcceptanceCurrentPeriod: new Decimal(0),
        actualAcceptanceCurrentPeriod: new Decimal(0),
        contractCount: 0,
        startDate: null,
        endDate: null,
      };
      current.contractValue = current.contractValue.add(m.contractValue);
      current.plannedAcceptanceToDate = current.plannedAcceptanceToDate.add(
        m.plannedAcceptanceToDate,
      );
      current.actualAcceptanceToDate = current.actualAcceptanceToDate.add(
        m.actualAcceptanceToDate,
      );
      current.actualCollectionToDate = current.actualCollectionToDate.add(
        m.actualCollectionToDate,
      );
      current.plannedAcceptanceCurrentPeriod =
        current.plannedAcceptanceCurrentPeriod.add(
          m.plannedAcceptanceCurrentPeriod,
        );
      current.actualAcceptanceCurrentPeriod =
        current.actualAcceptanceCurrentPeriod.add(
          m.actualAcceptanceCurrentPeriod,
        );
      current.contractCount += 1;
      if (contract.startDate) {
        if (!current.startDate || contract.startDate < current.startDate) {
          current.startDate = contract.startDate;
        }
      }
      if (contract.endDate) {
        if (!current.endDate || contract.endDate > current.endDate) {
          current.endDate = contract.endDate;
        }
      }
      projectMap.set(key, current);
    }

    return Array.from(projectMap.values())
      .sort((a, b) => a.projectCode.localeCompare(b.projectCode))
      .map((row) => {
        const acceptanceGap = row.plannedAcceptanceToDate.sub(
          row.actualAcceptanceToDate,
        );
        return {
          projectId: row.projectId,
          projectCode: row.projectCode,
          projectName: row.projectName,
          customerName: row.customerName,
          contractValue: toDecimalString(row.contractValue),
          plannedAcceptanceToDate: toDecimalString(row.plannedAcceptanceToDate),
          actualAcceptanceToDate: toDecimalString(row.actualAcceptanceToDate),
          acceptanceGap: toDecimalString(acceptanceGap),
          acceptancePercent: pctOfValue(
            row.actualAcceptanceToDate,
            row.contractValue,
          ),
          actualCollectionToDate: toDecimalString(row.actualCollectionToDate),
          collectionPercent: pctOfValue(
            row.actualCollectionToDate,
            row.contractValue,
          ),
          plannedAcceptanceCurrentPeriod: toDecimalString(
            row.plannedAcceptanceCurrentPeriod,
          ),
          actualAcceptanceCurrentPeriod: toDecimalString(
            row.actualAcceptanceCurrentPeriod,
          ),
          contractCount: row.contractCount,
          startDate: row.startDate?.toISOString() ?? null,
          endDate: row.endDate?.toISOString() ?? null,
        };
      });
  }

  private buildKpiMonthBreakdown(
    scope: Awaited<ReturnType<typeof this.loadScope>>,
    period: string,
  ) {
    const nextPeriod = shiftPeriodMonths(period, 1);
    const acceptanceAggregatesByContract = new Map<
      string,
      ReturnType<typeof buildAcceptancePlanAggregates>
    >();
    for (const contract of scope.contracts) {
      acceptanceAggregatesByContract.set(
        contract.id,
        buildAcceptancePlanAggregates(
          scope.acceptances
            .filter((a) => a.contractId === contract.id)
            .map((a) => ({
              acceptanceNo: a.acceptanceNo,
              period: a.period,
              scheduleId: a.scheduleId,
              amount: a.amount,
            })),
        ),
      );
    }

    const rows: Array<{
      contractId: string;
      contractNo: string;
      contractName: string;
      billingCycle: string;
      projectId: string;
      projectCode: string;
      projectName: string;
      projectManagerName: string | null;
      plannedAmount: string;
      revenuePlansInPeriod: Array<{
        id: string;
        plannedAmount: string;
        batchSequence: number | null;
        subBatchIndex: number | null;
        period: string;
        actualAcceptance: string;
      }>;
      actualWorkAmount: string;
      actualAcceptance: string;
      collectedAmount: string;
      acceptanceGap: string;
      nextPlannedAmount: string;
      revenuePlansInNextPeriod: Array<{
        id: string;
        plannedAmount: string;
        batchSequence: number | null;
        subBatchIndex: number | null;
        period: string;
      }>;
      overdueAcceptanceNotes: Array<{
        batchSequence: number;
        periodStartDate: string | null;
        periodEndDate: string | null;
        plannedAmount: string;
      }>;
    }> = [];

    for (const contract of scope.contracts) {
      const periodPlans = scope.plans.filter(
        (p) =>
          p.contractId === contract.id &&
          planMatchesDashboardMonth(p, period, contract.billingCycle),
      );
      const nextPeriodPlans = scope.plans.filter(
        (p) =>
          p.contractId === contract.id &&
          planMatchesDashboardMonth(p, nextPeriod, contract.billingCycle),
      );
      const planned = sumDecimals(periodPlans.map((p) => p.plannedAmount));
      const nextPlanned = sumDecimals(
        nextPeriodPlans.map((p) => p.plannedAmount),
      );
      const actualWork = sumDecimals(
        scope.monthlyFinancials
          .filter((m) => m.contractId === contract.id && m.period === period)
          .map((m) => m.actualWorkAmount),
      );
      const contractAcceptances = scope.acceptances
        .filter((a) => a.contractId === contract.id)
        .map((a) => ({
          acceptanceNo: a.acceptanceNo,
          period: a.period,
          scheduleId: a.scheduleId,
          amount: a.amount,
          acceptanceDate: a.acceptanceDate,
        }));
      const contractAllPlans = scope.plans.filter(
        (p) => p.contractId === contract.id,
      );
      const contractPlanPeriods = new Set(
        contractAllPlans.map((p) => p.period),
      );
      const agg = acceptanceAggregatesByContract.get(contract.id);
      const actual = sumDecimals(
        periodPlans.map((plan) =>
          agg
            ? sumAcceptanceForPlan(
                plan,
                agg,
                contractAcceptances,
                contractPlanPeriods,
              )
            : new Decimal(0),
        ),
      );
      const collected = sumDecimals(
        scope.collections
          .filter((c) => {
            if (c.contractId !== contract.id) return false;
            const occurrence = collectionOccurrencePeriod({
              collectionDate: c.collectionDate,
              period: c.period,
            });
            return occurrence === period;
          })
          .map((c) => c.amount),
      );
      if (
        compareDecimals(planned, 0) <= 0 &&
        compareDecimals(actualWork, 0) <= 0 &&
        compareDecimals(actual, 0) <= 0 &&
        compareDecimals(collected, 0) <= 0 &&
        compareDecimals(nextPlanned, 0) <= 0
      ) {
        continue;
      }

      const overdueAcceptanceNotes = agg
        ? listOverdueUnacceptedAcceptanceBatches({
            plans: contractAllPlans.map((p) => ({
              batchSequence: p.batchSequence,
              scheduleId: p.scheduleId,
              period: p.period,
              periodStartDate: p.periodStartDate,
              periodEndDate: p.periodEndDate,
              plannedAmount: p.plannedAmount,
            })),
            aggregates: agg,
            acceptances: contractAcceptances,
            contractPlanPeriods,
            now: scope.clock.now,
          })
        : [];

      const mapPlanSlices = (
        plansForMonth: typeof periodPlans,
      ): (typeof rows)[number]['revenuePlansInPeriod'] =>
        plansForMonth
          .slice()
          .sort((a, b) => {
            if (a.batchSequence != null && b.batchSequence != null) {
              const byBatch = a.batchSequence - b.batchSequence;
              if (byBatch !== 0) return byBatch;
            }
            return a.period.localeCompare(b.period);
          })
          .map((p) => ({
            id: p.id,
            plannedAmount: toDecimalString(p.plannedAmount),
            batchSequence: p.batchSequence,
            subBatchIndex: subBatchIndexForPlan(p, contractAllPlans),
            period: p.period,
            actualAcceptance: toDecimalString(
              agg
                ? sumAcceptanceForPlan(
                    p,
                    agg,
                    contractAcceptances,
                    contractPlanPeriods,
                  )
                : new Decimal(0),
            ),
          }));

      rows.push({
        contractId: contract.id,
        contractNo: contract.contractNo,
        contractName: contract.name,
        billingCycle: contract.billingCycle,
        projectId: contract.project.id,
        projectCode: contract.project.code,
        projectName: contract.project.name,
        projectManagerName:
          contract.project.assignments[0]?.note?.trim() || null,
        plannedAmount: toDecimalString(planned),
        revenuePlansInPeriod: mapPlanSlices(periodPlans),
        actualWorkAmount: toDecimalString(actualWork),
        actualAcceptance: toDecimalString(actual),
        collectedAmount: toDecimalString(collected),
        acceptanceGap: toDecimalString(planned.sub(actual)),
        nextPlannedAmount: toDecimalString(nextPlanned),
        revenuePlansInNextPeriod: mapPlanSlices(nextPeriodPlans).map(
          ({ actualAcceptance: _drop, ...rest }) => rest,
        ),
        overdueAcceptanceNotes,
      });
    }

    const rowWeight = (row: {
      plannedAmount: string;
      actualWorkAmount: string;
      actualAcceptance: string;
      collectedAmount: string;
    }) => {
      let best = new Decimal(0);
      for (const key of [
        row.plannedAmount,
        row.actualWorkAmount,
        row.actualAcceptance,
        row.collectedAmount,
      ] as const) {
        const d = new Decimal(key);
        if (d.gt(best)) best = d;
      }
      return best;
    };

    rows.sort((a, b) => {
      const byWeight = rowWeight(b).cmp(rowWeight(a));
      if (byWeight !== 0) return byWeight;
      return compareDecimals(b.plannedAmount, a.plannedAmount);
    });

    return { period, nextPeriod, rows: rows.slice(0, 500) };
  }

  private async loadReportedRevenueByProject(
    projectIds: string[],
    period: string,
  ): Promise<Map<string, Decimal>> {
    const map = new Map<string, Decimal>();
    if (projectIds.length === 0) return map;
    const submissions = await this.prisma.projectReportSubmission.findMany({
      where: {
        period,
        deletedAt: null,
        projectId: { in: projectIds },
      },
      select: {
        projectId: true,
        lines: { select: { reportedPlannedAmount: true } },
      },
    });
    for (const sub of submissions) {
      const sum = sumDecimals(sub.lines.map((l) => l.reportedPlannedAmount));
      const prev = map.get(sub.projectId) ?? new Decimal(0);
      map.set(sub.projectId, prev.add(sum));
    }
    return map;
  }

  private buildProjectPeriodBreakdown(
    scope: Awaited<ReturnType<typeof this.loadScope>>,
    period: string,
    reportedRevenueByProject: Map<string, Decimal> = new Map(),
  ) {
    const contractById = new Map(scope.contracts.map((c) => [c.id, c]));

    type Acc = {
      projectId: string;
      projectCode: string;
      projectName: string;
      customerName: string | null;
      projectManagerName: string | null;
      planned: Decimal;
      actualWork: Decimal;
      actual: Decimal;
      collected: Decimal;
      operatingCost: Decimal;
      reportedRevenue: Decimal;
    };

    const projectMeta = new Map<
      string,
      Omit<
        Acc,
        | 'planned'
        | 'actualWork'
        | 'actual'
        | 'collected'
        | 'operatingCost'
        | 'reportedRevenue'
      >
    >();
    for (const c of scope.contracts) {
      if (projectMeta.has(c.project.id)) continue;
      projectMeta.set(c.project.id, {
        projectId: c.project.id,
        projectCode: c.project.code,
        projectName: c.project.name,
        customerName: c.project.customer?.name ?? null,
        projectManagerName:
          c.project.assignments[0]?.note?.trim() || null,
      });
    }

    const byProject = new Map<string, Acc>();

    const ensure = (projectId: string): Acc | null => {
      const meta = projectMeta.get(projectId);
      if (!meta) return null;
      let acc = byProject.get(projectId);
      if (!acc) {
        acc = {
          ...meta,
          planned: new Decimal(0),
          actualWork: new Decimal(0),
          actual: new Decimal(0),
          collected: new Decimal(0),
          operatingCost: new Decimal(0),
          reportedRevenue:
            reportedRevenueByProject.get(projectId) ?? new Decimal(0),
        };
        byProject.set(projectId, acc);
      }
      return acc;
    };

    const acceptanceAggregatesByContract = new Map<
      string,
      ReturnType<typeof buildAcceptancePlanAggregates>
    >();
    for (const contract of scope.contracts) {
      acceptanceAggregatesByContract.set(
        contract.id,
        buildAcceptancePlanAggregates(
          scope.acceptances
            .filter((a) => a.contractId === contract.id)
            .map((a) => ({
              acceptanceNo: a.acceptanceNo,
              period: a.period,
              scheduleId: a.scheduleId,
              amount: a.amount,
            })),
        ),
      );
    }

    for (const contract of scope.contracts) {
      const periodPlans = scope.plans.filter(
        (p) =>
          p.contractId === contract.id &&
          planMatchesDashboardMonth(p, period, contract.billingCycle),
      );
      if (periodPlans.length === 0) continue;
      const acc = ensure(contract.project.id);
      if (!acc) continue;
      acc.planned = acc.planned.add(
        sumDecimals(periodPlans.map((p) => p.plannedAmount)),
      );

      const contractAllPlans = scope.plans.filter(
        (p) => p.contractId === contract.id,
      );
      const contractPlanPeriods = new Set(
        contractAllPlans.map((p) => p.period),
      );
      const agg = acceptanceAggregatesByContract.get(contract.id);
      const contractAcceptances = scope.acceptances
        .filter((a) => a.contractId === contract.id)
        .map((a) => ({
          acceptanceNo: a.acceptanceNo,
          period: a.period,
          scheduleId: a.scheduleId,
          amount: a.amount,
          acceptanceDate: a.acceptanceDate,
        }));
      const actualForMonth = sumDecimals(
        periodPlans.map((plan) =>
          agg
            ? sumAcceptanceForPlan(
                plan,
                agg,
                contractAcceptances,
                contractPlanPeriods,
              )
            : new Decimal(0),
        ),
      );
      acc.actual = acc.actual.add(actualForMonth);
    }

    for (const row of scope.collections) {
      const occurrence = collectionOccurrencePeriod({
        collectionDate: row.collectionDate,
        period: row.period,
      });
      if (occurrence !== period) continue;
      const contract = contractById.get(row.contractId);
      if (!contract) continue;
      const acc = ensure(contract.project.id);
      if (!acc) continue;
      acc.collected = acc.collected.add(row.amount);
    }

    for (const row of scope.operatingCosts) {
      if (row.period !== period) continue;
      const meta = projectMeta.get(row.projectId);
      if (!meta) continue;
      const acc = ensure(row.projectId);
      if (!acc) continue;
      acc.operatingCost = acc.operatingCost.add(row.amount);
    }

    for (const [projectId, revenue] of reportedRevenueByProject) {
      if (compareDecimals(revenue, 0) <= 0) continue;
      const meta = projectMeta.get(projectId);
      if (!meta) continue;
      if (!byProject.has(projectId)) {
        byProject.set(projectId, {
          ...meta,
          planned: new Decimal(0),
          actualWork: new Decimal(0),
          actual: new Decimal(0),
          collected: new Decimal(0),
          operatingCost: new Decimal(0),
          reportedRevenue: revenue,
        });
      }
    }

    const rows = Array.from(byProject.values())
      .filter(
        (acc) =>
          compareDecimals(acc.planned, 0) > 0 ||
          compareDecimals(acc.actual, 0) > 0 ||
          compareDecimals(acc.collected, 0) > 0 ||
          compareDecimals(acc.operatingCost, 0) > 0 ||
          compareDecimals(acc.reportedRevenue, 0) > 0,
      )
      .map((acc) => {
        const acceptanceGap = acc.planned.sub(acc.actual);
        const collectionGap = acc.actual.sub(acc.collected);
        return {
          projectId: acc.projectId,
          projectCode: acc.projectCode,
          projectName: acc.projectName,
          customerName: acc.customerName,
          projectManagerName: acc.projectManagerName,
          plannedAcceptance: toDecimalString(acc.planned),
          reportedRevenue: toDecimalString(acc.reportedRevenue),
          actualWork: toDecimalString(acc.actualWork),
          actualAcceptance: toDecimalString(acc.actual),
          actualCollection: toDecimalString(acc.collected),
          operatingCost: toDecimalString(acc.operatingCost),
          acceptanceGap: toDecimalString(acceptanceGap),
          collectionGap: toDecimalString(collectionGap),
          acceptanceProgressPeriod: pctOfValue(acc.actual, acc.planned),
          behindSchedule: compareDecimals(acceptanceGap, 0) > 0,
        };
      });

    rows.sort((a, b) => {
      if (a.behindSchedule !== b.behindSchedule) {
        return a.behindSchedule ? -1 : 1;
      }
      const byGap = compareDecimals(b.acceptanceGap, a.acceptanceGap);
      if (byGap !== 0) return byGap;
      return compareDecimals(b.plannedAcceptance, a.plannedAcceptance);
    });

    return { period, rows: rows.slice(0, 300) };
  }

  private buildReceivablesMonitor(
    scope: Awaited<ReturnType<typeof this.loadScope>>,
    fromPeriod: string,
    toPeriod: string,
  ) {
    let from = fromPeriod;
    let to = toPeriod;
    if (from > to) {
      const swap = from;
      from = to;
      to = swap;
    }

    const contractById = new Map(scope.contracts.map((c) => [c.id, c]));

    const acceptedByKey = new Map<string, Decimal>();
    for (const row of scope.acceptances) {
      const key = `${row.contractId}:${row.period}`;
      acceptedByKey.set(
        key,
        (acceptedByKey.get(key) ?? new Decimal(0)).add(row.amount),
      );
    }

    const collectedByKey = new Map<string, Decimal>();
    for (const row of scope.collections) {
      const key = `${row.contractId}:${row.period}`;
      collectedByKey.set(
        key,
        (collectedByKey.get(key) ?? new Decimal(0)).add(row.amount),
      );
    }

    const rows: Array<{
      acceptanceId: string;
      acceptanceNo: string;
      period: string;
      contractId: string;
      contractNo: string;
      contractName: string;
      projectId: string;
      projectCode: string;
      projectName: string;
      customerName: string | null;
      acceptanceAmount: string;
      unpaidAmount: string;
      agingDays: number | null;
      daysUntilDue: number | null;
    }> = [];

    for (const acc of scope.acceptances) {
      if (acc.paymentStatus === AcceptancePaymentStatus.COLLECTED) {
        continue;
      }
      if (acc.period < from || acc.period > to) continue;

      const key = `${acc.contractId}:${acc.period}`;
      const acceptedTotal = acceptedByKey.get(key) ?? new Decimal(0);
      const collectedTotal = collectedByKey.get(key) ?? new Decimal(0);
      if (compareDecimals(collectedTotal, acceptedTotal) >= 0) {
        continue;
      }

      const contract = contractById.get(acc.contractId);
      if (!contract) continue;

      const periodGap = acceptedTotal.sub(collectedTotal);
      const unpaid = Decimal.min(acc.amount, periodGap);
      if (compareDecimals(unpaid, 0) <= 0) continue;

      const aging = computeAcceptancePaymentAging(
        acc,
        contract.paymentTermDays,
        scope.clock.now,
      );

      rows.push({
        acceptanceId: acc.id,
        acceptanceNo: acc.acceptanceNo,
        period: acc.period,
        contractId: contract.id,
        contractNo: contract.contractNo,
        contractName: contract.name,
        projectId: contract.project.id,
        projectCode: contract.project.code,
        projectName: contract.project.name,
        customerName: contract.project.customer?.name ?? null,
        acceptanceAmount: toDecimalString(acc.amount),
        unpaidAmount: toDecimalString(unpaid),
        agingDays: aging.agingDays,
        daysUntilDue: aging.daysUntilDue,
      });
    }

    rows.sort((a, b) => {
      const ageA = a.agingDays ?? -1;
      const ageB = b.agingDays ?? -1;
      if (ageB !== ageA) return ageB - ageA;
      const byUnpaid = compareDecimals(b.unpaidAmount, a.unpaidAmount);
      if (byUnpaid !== 0) return byUnpaid;
      return b.period.localeCompare(a.period);
    });

    return { fromPeriod: from, toPeriod: to, rows: rows.slice(0, 2000) };
  }

  async getReceivablesMonitor(query: DashboardOverviewQueryDto) {
    const scope = await this.loadScope(query);
    const to =
      query.receivablesToPeriod ?? scope.clock.currentPeriod;
    const from =
      query.receivablesFromPeriod ?? shiftPeriodMonths(to, -5);
    return this.buildReceivablesMonitor(scope, from, to);
  }

  async getTrendPeriodByProject(query: { period: string } & DashboardOverviewQueryDto) {
    const scope = await this.loadScope(query);
    const projectIds = [...new Set(scope.contracts.map((c) => c.projectId))];
    const reportedMap = await this.loadReportedRevenueByProject(
      projectIds,
      query.period,
    );
    return this.buildProjectPeriodBreakdown(scope, query.period, reportedMap);
  }

  private buildExpiringContracts(
    scope: Awaited<ReturnType<typeof this.loadScope>>,
  ) {
    const { todayUtc } = scope.clock;
    return scope.contracts
      .filter((c) =>
        isExpiringSoon(c.status, c.endDate, todayUtc, EXPIRING_CONTRACT_WARN_DAYS),
      )
      .map((c) => ({
        contractId: c.id,
        contractNo: c.contractNo,
        contractName: c.name,
        status: c.status,
        projectId: c.project.id,
        projectCode: c.project.code,
        projectName: c.project.name,
        customerName: c.project.customer?.name ?? null,
        contractValue: toDecimalString(c.contractValue),
        endDate: c.endDate?.toISOString() ?? null,
      }))
      .sort((a, b) => {
        const ta = a.endDate ? new Date(a.endDate).getTime() : 0;
        const tb = b.endDate ? new Date(b.endDate).getTime() : 0;
        return ta - tb;
      });
  }

  private buildActionLists(
    scope: Awaited<ReturnType<typeof this.loadScope>>,
    referencePeriod: string,
  ) {
    const contractById = new Map(scope.contracts.map((c) => [c.id, c]));

    const aggregatesByContract = new Map<
      string,
      ReturnType<typeof buildAcceptancePlanAggregates>
    >();
    for (const c of scope.contracts) {
      const rows = scope.acceptances.filter((a) => a.contractId === c.id);
      aggregatesByContract.set(c.id, buildAcceptancePlanAggregates(rows));
    }

    const acceptancesByContract = new Map<
      string,
      Array<{
        acceptanceNo: string;
        period: string;
        scheduleId: string | null;
        amount: Decimal;
        acceptanceDate: Date | null;
      }>
    >();
    for (const c of scope.contracts) {
      acceptancesByContract.set(
        c.id,
        scope.acceptances
          .filter((a) => a.contractId === c.id)
          .map((a) => ({
            acceptanceNo: a.acceptanceNo,
            period: a.period,
            scheduleId: a.scheduleId,
            amount: a.amount,
            acceptanceDate: a.acceptanceDate,
          })),
      );
    }

    const planPeriodsByContract = new Map<string, Set<string>>();
    for (const plan of scope.plans) {
      let periods = planPeriodsByContract.get(plan.contractId);
      if (!periods) {
        periods = new Set();
        planPeriodsByContract.set(plan.contractId, periods);
      }
      periods.add(plan.period);
    }

    const actualAcceptanceByKey = new Map<string, Decimal>();
    for (const plan of scope.plans) {
      const agg = aggregatesByContract.get(plan.contractId);
      if (!agg) continue;
      const key = `${plan.contractId}:${plan.period}`;
      const amount = sumAcceptanceForPlan(
        plan,
        agg,
        acceptancesByContract.get(plan.contractId),
        planPeriodsByContract.get(plan.contractId),
      );
      actualAcceptanceByKey.set(key, amount);
    }

    const collectionByKey = new Map<string, Decimal>();
    for (const row of scope.collections) {
      const key = `${row.contractId}:${row.period}`;
      collectionByKey.set(
        key,
        (collectionByKey.get(key) ?? new Decimal(0)).add(row.amount),
      );
    }

    const pendingAcceptance: Array<{
      contractId: string;
      contractNo: string;
      contractName: string;
      projectId: string;
      projectCode: string;
      period: string;
      plannedAmount: string;
      actualAcceptance: string;
      gapAmount: string;
    }> = [];

    for (const plan of scope.plans) {
      if (plan.period > referencePeriod) continue;
      if (compareDecimals(plan.plannedAmount, 0) <= 0) continue;
      const contract = contractById.get(plan.contractId);
      if (!contract) continue;
      const key = `${plan.contractId}:${plan.period}`;
      const actual = actualAcceptanceByKey.get(key) ?? new Decimal(0);
      if (compareDecimals(actual, plan.plannedAmount) >= 0) continue;
      pendingAcceptance.push({
        contractId: contract.id,
        contractNo: contract.contractNo,
        contractName: contract.name,
        projectId: contract.project.id,
        projectCode: contract.project.code,
        period: plan.period,
        plannedAmount: toDecimalString(plan.plannedAmount),
        actualAcceptance: toDecimalString(actual),
        gapAmount: toDecimalString(plan.plannedAmount.sub(actual)),
      });
    }

    const pendingCollection: Array<{
      contractId: string;
      contractNo: string;
      contractName: string;
      projectId: string;
      projectCode: string;
      period: string;
      acceptedAmount: string;
      collectedAmount: string;
      gapAmount: string;
      agingDays: number | null;
      daysUntilDue: number | null;
    }> = [];

    const collectionGapKeys = new Set<string>();
    for (const [key, accepted] of actualAcceptanceByKey) {
      const colon = key.indexOf(':');
      const period = key.slice(colon + 1);
      if (period > referencePeriod) continue;
      const collected = collectionByKey.get(key) ?? new Decimal(0);
      if (compareDecimals(collected, accepted) >= 0) continue;
      const gap = accepted.sub(collected);
      if (compareDecimals(gap, 0) <= 0) continue;
      collectionGapKeys.add(key);
    }

    const agingByKey = new Map<string, AcceptancePaymentAging>();
    for (const row of scope.acceptances) {
      const key = `${row.contractId}:${row.period}`;
      if (!collectionGapKeys.has(key)) continue;
      const contract = contractById.get(row.contractId);
      if (!contract) continue;
      const aging = computeAcceptancePaymentAging(
        row,
        contract.paymentTermDays,
        scope.clock.now,
      );
      agingByKey.set(
        key,
        mergeWorstAcceptancePaymentAging(agingByKey.get(key) ?? null, aging),
      );
    }

    for (const key of collectionGapKeys) {
      const colon = key.indexOf(':');
      const contractId = key.slice(0, colon);
      const period = key.slice(colon + 1);
      const contract = contractById.get(contractId);
      if (!contract) continue;
      const accepted = actualAcceptanceByKey.get(key) ?? new Decimal(0);
      const collected = collectionByKey.get(key) ?? new Decimal(0);
      const gap = accepted.sub(collected);
      const aging = agingByKey.get(key) ?? {
        agingDays: null,
        daysUntilDue: null,
      };
      pendingCollection.push({
        contractId: contract.id,
        contractNo: contract.contractNo,
        contractName: contract.name,
        projectId: contract.project.id,
        projectCode: contract.project.code,
        period,
        acceptedAmount: toDecimalString(accepted),
        collectedAmount: toDecimalString(collected),
        gapAmount: toDecimalString(gap),
        agingDays: aging.agingDays,
        daysUntilDue: aging.daysUntilDue,
      });
    }

    const byGapDesc = (a: { gapAmount: string }, b: { gapAmount: string }) =>
      compareDecimals(b.gapAmount, a.gapAmount);

    pendingAcceptance.sort(byGapDesc);
    pendingCollection.sort(byGapDesc);

    const limit = 200;
    return {
      pendingAcceptance: pendingAcceptance.slice(0, limit),
      pendingCollection: pendingCollection.slice(0, limit),
      referencePeriod,
    };
  }

  async getOverview(query: DashboardOverviewQueryDto) {
    const scope = await this.loadScope(query);
    const maps = this.buildPeriodMaps(scope);
    const kpiPeriod = this.resolveKpiPeriod(
      query.kpiPeriod,
      scope.clock.currentPeriod,
    );
    const summary = this.buildSummary(scope, maps, kpiPeriod);
    const referencePeriod = this.resolveKpiPeriod(
      query.actionPeriod,
      scope.clock.currentPeriod,
    );
    const cumulativeTrend = this.buildCumulativeTrend(
      maps,
      query,
      scope.clock.currentPeriod,
    );
    const byProject = this.buildByProject(scope, maps);
    const actionLists = this.buildActionLists(scope, referencePeriod);
    const kpiMonthBreakdown = this.buildKpiMonthBreakdown(scope, kpiPeriod);
    const projectRevenueReport = this.buildProjectPeriodBreakdown(
      scope,
      kpiPeriod,
      new Map(),
    );
    const expiringContracts = this.buildExpiringContracts(scope);

    return {
      summary,
      cumulativeTrend,
      byProject,
      actionLists,
      kpiMonthBreakdown,
      projectRevenueReport,
      expiringContracts,
      filters: query,
    };
  }

  async getTimeline(query: DashboardTimelineQueryDto) {
    const scope = await this.loadScope(query);
    const maps = this.buildPeriodMaps(scope);
    const { currentPeriod, todayUtc } = scope.clock;

    const rows = scope.contracts.map((contract) => {
      const m = this.contractMetrics(
        contract,
        scope,
        currentPeriod,
        todayUtc,
      );
      return {
        contractId: contract.id,
        contractNo: contract.contractNo,
        name: contract.name,
        status: contract.status,
        projectId: contract.project.id,
        projectCode: contract.project.code,
        projectName: contract.project.name,
        customerId: contract.project.customer?.id ?? null,
        customerCode: contract.project.customer?.code ?? null,
        customerName: contract.project.customer?.name ?? null,
        contractValue: toDecimalString(m.contractValue),
        startDate: contract.startDate?.toISOString() ?? null,
        endDate: contract.endDate?.toISOString() ?? null,
        timeProgressPercent: m.timeProgressPercent,
        acceptancePercent: m.acceptancePercent,
        collectionPercent: m.collectionPercent,
        plannedAcceptanceToDate: toDecimalString(m.plannedAcceptanceToDate),
        actualAcceptanceToDate: toDecimalString(m.actualAcceptanceToDate),
        acceptanceGap: toDecimalString(m.acceptanceGap),
        actualCollectionToDate: toDecimalString(m.actualCollectionToDate),
        expiringSoon: isExpiringSoon(
          contract.status,
          contract.endDate,
          todayUtc,
          EXPIRING_CONTRACT_WARN_DAYS,
        ),
      };
    });

    const sort = query.sort ?? 'endDate';
    const order = query.order ?? 'asc';
    const sorted = [...rows].sort((a, b) =>
      compareTimelineRows(a, b, sort, order),
    );

    const page = query.page ?? 1;
    const limit = query.limit ?? 30;
    const total = sorted.length;
    const start = (page - 1) * limit;
    const items = sorted.slice(start, start + limit);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 0,
      },
    };
  }

  async getProjectDashboard(
    projectId: string,
    query: DashboardOverviewQueryDto = {},
  ) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, deletedAt: null },
      include: {
        customer: { select: { id: true, code: true, name: true } },
      },
    });
    if (!project) {
      throw new NotFoundException(`Project ${projectId} not found`);
    }

    const scope = await this.loadScope({ ...query, projectId });
    const maps = this.buildPeriodMaps(scope);
    const kpiPeriod = this.resolveKpiPeriod(
      query.projectPeriod ?? query.kpiPeriod,
      scope.clock.currentPeriod,
    );
    const summary = this.buildSummary(scope, maps, kpiPeriod);
    const periodKeys = this.periodKeysFromMaps(maps);
    const projectRange = resolveProjectChartPeriodRange({
      contracts: scope.contracts,
      currentPeriod: scope.clock.currentPeriod,
      periodKeys,
      query,
    });
    let { fromPeriod, toPeriod } = projectRange;
    if (kpiPeriod < fromPeriod) fromPeriod = kpiPeriod;
    if (kpiPeriod > toPeriod) toPeriod = kpiPeriod;
    const cumulativeTrend = this.buildCumulativeTrend(
      maps,
      {
        ...query,
        fromPeriod,
        toPeriod,
      },
      scope.clock.currentPeriod,
    );

    const contractIds = scope.contracts.map((c) => c.id);
    const [schedules, allAcceptances] =
      contractIds.length > 0
        ? await Promise.all([
            this.prisma.acceptanceSchedule.findMany({
              where: { contractId: { in: contractIds } },
            }),
            this.prisma.acceptance.findMany({
              where: { contractId: { in: contractIds }, deletedAt: null },
            }),
          ])
        : [[], []];

    const schedulesByContract = new Map<string, typeof schedules>();
    for (const s of schedules) {
      const list = schedulesByContract.get(s.contractId) ?? [];
      list.push(s);
      schedulesByContract.set(s.contractId, list);
    }
    const acceptancesByContract = new Map<string, typeof allAcceptances>();
    for (const a of allAcceptances) {
      const list = acceptancesByContract.get(a.contractId) ?? [];
      list.push(a);
      acceptancesByContract.set(a.contractId, list);
    }
    const plansByContract = new Map<string, typeof scope.plans>();
    for (const p of scope.plans) {
      const list = plansByContract.get(p.contractId) ?? [];
      list.push(p);
      plansByContract.set(p.contractId, list);
    }

    const { currentPeriod, todayUtc, now } = scope.clock;
    const contracts = scope.contracts.map((contract) => {
      const m = this.contractMetrics(
        contract,
        scope,
        currentPeriod,
        todayUtc,
      );
      const roundStats = buildContractRoundStats({
        contract,
        schedules: schedulesByContract.get(contract.id) ?? [],
        acceptances: acceptancesByContract.get(contract.id) ?? [],
        plans: plansByContract.get(contract.id) ?? [],
        now,
      });
      return {
        contractId: contract.id,
        contractNo: contract.contractNo,
        name: contract.name,
        status: contract.status,
        customerName: contract.project.customer?.name ?? null,
        durationYears: contract.durationYears,
        billingCycle: contract.billingCycle,
        contractValue: toDecimalString(m.contractValue),
        startDate: contract.startDate?.toISOString() ?? null,
        endDate: contract.endDate?.toISOString() ?? null,
        plannedAcceptanceToDate: toDecimalString(m.plannedAcceptanceToDate),
        actualAcceptanceToDate: toDecimalString(m.actualAcceptanceToDate),
        acceptanceGap: toDecimalString(m.acceptanceGap),
        actualCollectionToDate: toDecimalString(m.actualCollectionToDate),
        outstandingCollection: toDecimalString(
          maxDecimal(m.actualAcceptanceToDate.sub(m.actualCollectionToDate), 0),
        ),
        timeProgressPercent: m.timeProgressPercent,
        acceptancePercent: m.acceptancePercent,
        collectionPercent: m.collectionPercent,
        ...roundStats,
      };
    });

    const timeline = contracts.map((c) => ({
      contractId: c.contractId,
      contractNo: c.contractNo,
      name: c.name,
      startDate: c.startDate,
      endDate: c.endDate,
      timeProgressPercent: c.timeProgressPercent,
      acceptancePercent: c.acceptancePercent,
      collectionPercent: c.collectionPercent,
      plannedAcceptanceToDate: c.plannedAcceptanceToDate,
      actualAcceptanceToDate: c.actualAcceptanceToDate,
      actualCollectionToDate: c.actualCollectionToDate,
      contractValue: c.contractValue,
    }));

    // Dự án 1 HĐ hoặc các HĐ cùng lịch đợt → biểu đồ theo đợt; khác lịch → theo tháng
    const projectBatchTrend = mergeContractBatchTrends(
      scope.contracts.map((c) => this.contractBatchTrend(c, scope)),
    );

    return {
      project: {
        id: project.id,
        code: project.code,
        name: project.name,
        customer: project.customer,
      },
      summary,
      cumulativeTrend,
      batchTrend: projectBatchTrend?.points ?? [],
      currentBatchPeriod: projectBatchTrend?.currentBatchPeriod ?? null,
      contracts,
      timeline,
    };
  }

  async getContractDashboard(contractId: string) {
    const contract = await this.prisma.contract.findFirst({
      where: { id: contractId, deletedAt: null },
      include: {
        project: {
          select: {
            id: true,
            code: true,
            name: true,
            customer: { select: { id: true, code: true, name: true } },
            assignments: {
              where: { role: ProjectAssignmentRole.PROJECT_MANAGER },
              take: 1,
              select: { note: true },
            },
          },
        },
      },
    });
    if (!contract) {
      throw new NotFoundException(`Contract ${contractId} not found`);
    }

    const scope = await this.loadScope({}, [contractId]);
    const [schedules, allAcceptances] = await Promise.all([
      this.prisma.acceptanceSchedule.findMany({
        where: { contractId },
      }),
      this.prisma.acceptance.findMany({
        where: { contractId, deletedAt: null },
      }),
    ]);
    return this.buildContractDashboardPayload(contract, scope, {
      schedules,
      allAcceptances,
    });
  }

  private buildContractDashboardPayload(
    contract: ContractRow,
    scope: Awaited<ReturnType<typeof this.loadScope>>,
    roundInputs?: {
      schedules: AcceptanceSchedule[];
      allAcceptances: Acceptance[];
    },
  ) {
    const contractOnly = {
      ...scope,
      contracts: scope.contracts.filter((c) => c.id === contract.id),
      plans: scope.plans.filter((p) => p.contractId === contract.id),
      acceptances: scope.acceptances.filter(
        (a) => a.contractId === contract.id,
      ),
      collections: scope.collections.filter(
        (c) => c.contractId === contract.id,
      ),
      monthlyFinancials: scope.monthlyFinancials.filter(
        (m) => m.contractId === contract.id,
      ),
    };

    const maps = this.buildPeriodMaps(contractOnly);
    maps.operatingCostByPeriod = new Map();
    const { currentPeriod, todayUtc, asOf } = contractOnly.clock;
    const m = this.contractMetrics(
      contract,
      contractOnly,
      currentPeriod,
      todayUtc,
    );

    const remainingAcceptance = maxDecimal(
      m.contractValue.sub(m.actualAcceptanceToDate),
      0,
    );
    const outstandingCollection = maxDecimal(
      m.actualAcceptanceToDate.sub(m.actualCollectionToDate),
      0,
    );

    const summary = {
      contractValue: toDecimalString(m.contractValue),
      plannedToDate: toDecimalString(m.plannedAcceptanceToDate),
      acceptedToDate: toDecimalString(m.actualAcceptanceToDate),
      acceptanceGap: toDecimalString(m.acceptanceGap),
      plannedInCurrentPeriod: toDecimalString(m.plannedAcceptanceCurrentPeriod),
      acceptedInCurrentPeriod: toDecimalString(m.actualAcceptanceCurrentPeriod),
      collectedInCurrentPeriod: toDecimalString(m.actualCollectionCurrentPeriod),
      collectedToDate: toDecimalString(m.actualCollectionToDate),
      totalCollected: toDecimalString(m.totalCollected),
      remainingAcceptance: toDecimalString(remainingAcceptance),
      outstandingCollection: toDecimalString(outstandingCollection),
      currentPeriod,
      asOf,
      timeProgressPercent: m.timeProgressPercent,
      acceptancePercent: m.acceptancePercent,
      collectionPercent: m.collectionPercent,
      acceptanceProgressPercent: m.acceptancePercent,
      collectionProgressPercent: m.collectionPercent,
    };

    const periodKeys = this.periodKeysFromMaps(maps);
    const planPeriods = [
      ...new Set(contractOnly.plans.map((p) => p.period)),
    ].sort();

    const { fromPeriod, toPeriod } = resolveContractChartPeriodRange({
      startDate: contract.startDate,
      endDate: contract.endDate,
      currentPeriod,
      periodKeys,
      planPeriods,
    });
    const monthlyRowsRaw = this.buildCumulativeTrend(
      maps,
      { fromPeriod, toPeriod },
      currentPeriod,
      { includeOperatingCost: false },
    );
    const monthlyRows = attachBatchMetadataToTrendPoints(
      monthlyRowsRaw,
      {
        startDate: contract.startDate,
        durationYears: contract.durationYears,
        billingCycle: contract.billingCycle,
        endDate: contract.endDate,
      },
      contractOnly.plans,
    );

    // Biểu đồ HĐ theo đợt NT (mọi chu kỳ) — không theo tháng / ngày NT
    const batchTrend = this.contractBatchTrend(
      contract,
      contractOnly,
      roundInputs?.allAcceptances,
    );

    const roundStats = roundInputs
      ? buildContractRoundStats({
          contract,
          schedules: roundInputs.schedules,
          acceptances: roundInputs.allAcceptances,
          plans: contractOnly.plans,
          now: contractOnly.clock.now,
        })
      : {
          scheduleTotalRounds: 0,
          scheduleSubmittedRounds: 0,
          scheduleApprovedRounds: 0,
          scheduleCompletedRounds: 0,
          scheduleRemainingRounds: 0,
          schedulePendingDocRounds: 0,
          scheduleLateRounds: 0,
          scheduleHint: '',
        };

    return {
      contract: {
        id: contract.id,
        contractNo: contract.contractNo,
        name: contract.name,
        status: contract.status,
        contractValue: toDecimalString(contract.contractValue),
        startDate: contract.startDate?.toISOString() ?? null,
        endDate: contract.endDate?.toISOString() ?? null,
        billingCycle: contract.billingCycle,
        durationYears: contract.durationYears,
        paymentTermDays: contract.paymentTermDays,
        project: contract.project,
      },
      summary,
      timeline: {
        startDate: contract.startDate?.toISOString() ?? null,
        endDate: contract.endDate?.toISOString() ?? null,
        currentPeriod,
        asOf,
        timeProgressPercent: m.timeProgressPercent,
      },
      monthlyTrend: monthlyRows,
      monthlyRows,
      /** Một điểm mỗi đợt NT — rỗng với HĐ nghiệm thu hàng tháng */
      batchTrend: batchTrend.points,
      currentBatchPeriod: batchTrend.currentBatchPeriod,
      scheduleTotalRounds: roundStats.scheduleTotalRounds,
      scheduleSubmittedRounds: roundStats.scheduleSubmittedRounds,
      scheduleHint: roundStats.scheduleHint,
    };
  }
}

type TimelineRowSortable = {
  contractNo?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  contractValue?: string;
  acceptanceGap?: string;
  acceptancePercent?: string | null;
};

function compareTimelineRows(
  a: TimelineRowSortable,
  b: TimelineRowSortable,
  sort: TimelineSortField,
  order: 'asc' | 'desc',
): number {
  const dir = order === 'asc' ? 1 : -1;

  const compareString = (x?: string | null, y?: string | null) =>
    (x ?? '').localeCompare(y ?? '') * dir;

  const compareNumber = (x?: string, y?: string) => {
    const left = new Decimal(x ?? 0);
    const right = new Decimal(y ?? 0);
    return compareDecimals(left, right) * dir;
  };

  switch (sort) {
    case 'contractNo':
      return compareString(a.contractNo, b.contractNo);
    case 'startDate':
      return compareString(a.startDate, b.startDate);
    case 'endDate':
      return compareString(a.endDate, b.endDate);
    case 'contractValue':
      return compareNumber(a.contractValue, b.contractValue);
    case 'acceptanceGap':
      return compareNumber(a.acceptanceGap, b.acceptanceGap);
    case 'acceptancePercent':
      return compareNumber(
        a.acceptancePercent ?? undefined,
        b.acceptancePercent ?? undefined,
      );
    default:
      return compareString(a.endDate, b.endDate);
  }
}
