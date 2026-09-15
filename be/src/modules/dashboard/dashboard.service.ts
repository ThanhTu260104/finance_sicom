import { Injectable } from '@nestjs/common';
import {
  AcceptancePaymentStatus,
  AcceptanceStatus,
  DocumentStatus,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../prisma/prisma.service';
import {
  compareDecimals,
  maxDecimal,
  sumDecimals,
  toDecimalString,
} from '../../common/utils/decimal.util';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview() {
    const [projects, contracts, plans, acceptances, collections] =
      await Promise.all([
        this.prisma.project.count({ where: { deletedAt: null } }),
        this.prisma.contract.findMany({
          where: { deletedAt: null },
          include: {
            project: { select: { id: true, code: true, name: true } },
          },
        }),
        this.prisma.revenuePlan.findMany(),
        this.prisma.acceptance.findMany({
          where: { deletedAt: null },
        }),
        this.prisma.collection.findMany({
          where: { deletedAt: null },
        }),
      ]);

    const contractValue = sumDecimals(contracts.map((c) => c.contractValue));
    const totalPlanned = sumDecimals(plans.map((p) => p.plannedAmount));

    const submittedAcceptances = acceptances.filter(
      (a) =>
        a.status === AcceptanceStatus.APPROVED &&
        a.documentStatus === DocumentStatus.SUBMITTED_UNPAID,
    );
    const totalAccepted = sumDecimals(
      submittedAcceptances.map((a) => a.amount),
    );
    const totalCollected = sumDecimals(collections.map((c) => c.amount));

    const remainingAcceptanceRaw = new Decimal(contractValue).sub(totalAccepted);
    const overContractValue = remainingAcceptanceRaw.isNegative();
    const remainingAcceptance = overContractValue
      ? new Decimal(0)
      : remainingAcceptanceRaw;
    const outstandingCollection = maxDecimal(
      new Decimal(totalAccepted).sub(totalCollected),
      0,
    );

    const acceptedCollected = sumDecimals(
      submittedAcceptances
        .filter((a) => a.paymentStatus === AcceptancePaymentStatus.COLLECTED)
        .map((a) => a.amount),
    );
    const acceptedUnpaid = sumDecimals(
      submittedAcceptances
        .filter(
          (a) =>
            a.paymentStatus === AcceptancePaymentStatus.WAITING_CLIENT_PAYMENT,
        )
        .map((a) => a.amount),
    );
    const notAcceptedAmount = sumDecimals(
      acceptances
        .filter(
          (a) =>
            a.documentStatus === DocumentStatus.NOT_SUBMITTED ||
            a.paymentStatus === AcceptancePaymentStatus.NOT_ACCEPTED,
        )
        .map((a) => a.amount),
    );

    const acceptanceRate = compareDecimals(contractValue, 0) > 0
      ? totalAccepted.div(contractValue).mul(100)
      : new Decimal(0);
    const collectionRate = compareDecimals(totalAccepted, 0) > 0
      ? totalCollected.div(totalAccepted).mul(100)
      : new Decimal(0);
    const planCompletionRate = compareDecimals(totalPlanned, 0) > 0
      ? totalAccepted.div(totalPlanned).mul(100)
      : new Decimal(0);

    const acceptedByContract = new Map<string, Decimal>();
    for (const row of submittedAcceptances) {
      acceptedByContract.set(
        row.contractId,
        (acceptedByContract.get(row.contractId) ?? new Decimal(0)).add(
          row.amount,
        ),
      );
    }
    const collectedByContract = new Map<string, Decimal>();
    for (const row of collections) {
      collectedByContract.set(
        row.contractId,
        (collectedByContract.get(row.contractId) ?? new Decimal(0)).add(
          row.amount,
        ),
      );
    }
    const plannedByContract = new Map<string, Decimal>();
    for (const row of plans) {
      plannedByContract.set(
        row.contractId,
        (plannedByContract.get(row.contractId) ?? new Decimal(0)).add(
          row.plannedAmount,
        ),
      );
    }

    const byProjectMap = new Map<
      string,
      {
        projectId: string;
        projectCode: string;
        projectName: string;
        contractValue: Decimal;
        planned: Decimal;
        accepted: Decimal;
        collected: Decimal;
      }
    >();

    for (const contract of contracts) {
      const key = contract.projectId;
      const current = byProjectMap.get(key) ?? {
        projectId: contract.project.id,
        projectCode: contract.project.code,
        projectName: contract.project.name,
        contractValue: new Decimal(0),
        planned: new Decimal(0),
        accepted: new Decimal(0),
        collected: new Decimal(0),
      };
      current.contractValue = current.contractValue.add(contract.contractValue);
      current.planned = current.planned.add(
        plannedByContract.get(contract.id) ?? new Decimal(0),
      );
      current.accepted = current.accepted.add(
        acceptedByContract.get(contract.id) ?? new Decimal(0),
      );
      current.collected = current.collected.add(
        collectedByContract.get(contract.id) ?? new Decimal(0),
      );
      byProjectMap.set(key, current);
    }

    const byProject = Array.from(byProjectMap.values())
      .sort((a, b) => b.contractValue.cmp(a.contractValue))
      .map((row) => {
        const remaining = maxDecimal(
          row.contractValue.sub(row.accepted),
          0,
        );
        const outstanding = maxDecimal(row.accepted.sub(row.collected), 0);
        return {
          projectId: row.projectId,
          projectCode: row.projectCode,
          projectName: row.projectName,
          contractValue: toDecimalString(row.contractValue),
          planned: toDecimalString(row.planned),
          accepted: toDecimalString(row.accepted),
          collected: toDecimalString(row.collected),
          remainingAcceptance: toDecimalString(remaining),
          outstandingCollection: toDecimalString(outstanding),
          acceptanceRatePercent: row.contractValue.gt(0)
            ? row.accepted.div(row.contractValue).mul(100).toDecimalPlaces(1).toFixed(1)
            : '0.0',
        };
      });

    const plannedByPeriod = new Map<string, Decimal>();
    for (const row of plans) {
      plannedByPeriod.set(
        row.period,
        (plannedByPeriod.get(row.period) ?? new Decimal(0)).add(
          row.plannedAmount,
        ),
      );
    }
    const acceptedByPeriod = new Map<string, Decimal>();
    for (const row of submittedAcceptances) {
      acceptedByPeriod.set(
        row.period,
        (acceptedByPeriod.get(row.period) ?? new Decimal(0)).add(row.amount),
      );
    }
    const collectedByPeriod = new Map<string, Decimal>();
    for (const row of collections) {
      collectedByPeriod.set(
        row.period,
        (collectedByPeriod.get(row.period) ?? new Decimal(0)).add(row.amount),
      );
    }

    const periods = Array.from(
      new Set([
        ...plannedByPeriod.keys(),
        ...acceptedByPeriod.keys(),
        ...collectedByPeriod.keys(),
      ]),
    ).sort();

    const monthlyTrend = periods.map((period) => ({
      period,
      planned: toDecimalString(plannedByPeriod.get(period) ?? new Decimal(0)),
      accepted: toDecimalString(acceptedByPeriod.get(period) ?? new Decimal(0)),
      collected: toDecimalString(
        collectedByPeriod.get(period) ?? new Decimal(0),
      ),
    }));

    const alerts = [
      ...byProject
        .filter((p) => compareDecimals(p.outstandingCollection, 0) > 0)
        .map((p) => ({
          type: 'OUTSTANDING' as const,
          projectCode: p.projectCode,
          message: `${p.projectCode}: CĐT còn nợ ${p.outstandingCollection}`,
          amount: p.outstandingCollection,
        })),
      ...byProject
        .filter((p) => compareDecimals(p.remainingAcceptance, 0) > 0)
        .slice(0, 4)
        .map((p) => ({
          type: 'PENDING_ACCEPTANCE' as const,
          projectCode: p.projectCode,
          message: `${p.projectCode}: còn ${p.remainingAcceptance} chưa nghiệm thu`,
          amount: p.remainingAcceptance,
        })),
    ];

    return {
      summary: {
        projectCount: projects,
        contractCount: contracts.length,
        contractValue: toDecimalString(contractValue),
        totalPlanned: toDecimalString(totalPlanned),
        totalAccepted: toDecimalString(totalAccepted),
        totalCollected: toDecimalString(totalCollected),
        remainingAcceptance: overContractValue
          ? 'OVER_CONTRACT_VALUE'
          : toDecimalString(remainingAcceptance),
        outstandingCollection: toDecimalString(outstandingCollection),
        overContractValue,
        acceptanceRatePercent: acceptanceRate.toDecimalPlaces(1).toFixed(1),
        collectionRatePercent: collectionRate.toDecimalPlaces(1).toFixed(1),
        planCompletionPercent: planCompletionRate.toDecimalPlaces(1).toFixed(1),
      },
      statusBreakdown: [
        {
          key: 'COLLECTED',
          label: 'Đã thu tiền',
          amount: toDecimalString(acceptedCollected),
        },
        {
          key: 'WAITING_PAYMENT',
          label: 'Đã nghiệm thu - chưa thu',
          amount: toDecimalString(acceptedUnpaid),
        },
        {
          key: 'NOT_ACCEPTED',
          label: 'Chưa nghiệm thu (chưa nộp HS)',
          amount: toDecimalString(notAcceptedAmount),
        },
        {
          key: 'REMAINING_CONTRACT',
          label: 'Còn lại trên HĐ (chưa ghi nhận đợt)',
          amount: toDecimalString(
            maxDecimal(
              new Decimal(contractValue)
                .sub(totalAccepted)
                .sub(notAcceptedAmount),
              0,
            ),
          ),
        },
      ],
      byProject,
      monthlyTrend,
      alerts,
    };
  }
}
