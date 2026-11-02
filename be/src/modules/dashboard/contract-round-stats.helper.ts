import {
  Acceptance,
  AcceptanceSchedule,
  BillingCycle,
  Contract,
  RevenuePlan,
} from '@prisma/client';
import { compareDecimals } from '../../common/utils/decimal.util';
import {
  countCollectedAcceptanceRounds,
  countLateAcceptanceRounds,
  countPendingDocAcceptanceRounds,
  countSubmittedDocumentAcceptanceRounds,
  expectedAcceptanceRounds,
  formatAcceptanceRoundHint,
  isActiveAcceptance,
  resolveTotalAcceptanceRounds,
  type AcceptanceRoundRow,
} from '../../common/contract-acceptance-rounds.util';

export function buildContractRoundStats(input: {
  contract: Pick<
    Contract,
    'durationYears' | 'billingCycle' | 'startDate' | 'endDate'
  >;
  schedules: AcceptanceSchedule[];
  acceptances: Acceptance[];
  plans: RevenuePlan[];
  now: Date;
}) {
  const { contract, schedules, acceptances, plans, now } = input;

  const expected = expectedAcceptanceRounds({
    durationYears: contract.durationYears,
    billingCycle: contract.billingCycle as BillingCycle,
  });

  const plannedInstallmentCount = new Set(
    plans
      .filter((p) => compareDecimals(p.plannedAmount, 0) > 0)
      .map((p) => p.period),
  ).size;

  const total = resolveTotalAcceptanceRounds({
    scheduleCount: schedules.length,
    expectedRounds: expected,
    plannedInstallmentCount,
  });

  const roundRows: AcceptanceRoundRow[] = acceptances
    .filter((a) => isActiveAcceptance(a.status))
    .map((a) => ({
      scheduleId: a.scheduleId,
      period: a.period,
      status: a.status,
      documentStatus: a.documentStatus,
      paymentStatus: a.paymentStatus,
    }));

  const submittedRounds = countSubmittedDocumentAcceptanceRounds(
    acceptances
      .filter((a) => a.deletedAt == null && isActiveAcceptance(a.status))
      .map((a) => ({
        scheduleId: a.scheduleId,
        period: a.period,
        status: a.status,
        documentStatus: a.documentStatus,
        paymentStatus: a.paymentStatus,
      })),
  );
  const collectedRounds = countCollectedAcceptanceRounds(roundRows);

  const pendingDocRounds = countPendingDocAcceptanceRounds(roundRows);
  const lateRounds = countLateAcceptanceRounds({
    now,
    schedules: schedules.map((s) => ({
      id: s.id,
      startPeriod: s.startPeriod,
      endPeriod: s.endPeriod,
      dueDate: s.dueDate,
    })),
    plans: plans.map((p) => ({
      period: p.period,
      plannedAmount: p.plannedAmount,
      plannedAcceptanceDate: p.plannedAcceptanceDate,
    })),
    acceptances: acceptances.map((a) => ({
      period: a.period,
      paymentStatus: a.paymentStatus,
      status: a.status,
      documentStatus: a.documentStatus,
    })),
  });

  const remaining = Math.max(total - submittedRounds, 0);
  const submittedWithoutPlan =
    total <= 0 && submittedRounds > 0 ? submittedRounds : 0;
  const collectedWithoutPlan =
    total <= 0 && collectedRounds > 0 ? collectedRounds : 0;

  const scheduleHint = formatAcceptanceRoundHint({
    total,
    submittedRounds,
    collectedRounds,
    remaining,
    lateRounds,
    pendingDocRounds,
    submittedWithoutPlan,
    collectedWithoutPlan,
  });

  return {
    scheduleTotalRounds: total,
    scheduleSubmittedRounds: submittedRounds,
    scheduleCompletedRounds: collectedRounds,
    scheduleApprovedRounds: submittedRounds,
    scheduleRemainingRounds: remaining,
    schedulePendingDocRounds: pendingDocRounds,
    scheduleLateRounds: lateRounds,
    scheduleHint,
  };
}
