import { Decimal } from '@prisma/client/runtime/library';
import {
  acceptanceMatchesRevenuePlan,
  buildAcceptancePlanAggregates,
  sumAcceptanceForPlan,
} from './acceptance-plan-match.util';

describe('sumAcceptanceForPlan', () => {
  it('matches by plan.period, not acceptanceNo batch', () => {
    const agg = buildAcceptancePlanAggregates([
      {
        acceptanceNo: 'Đợt 11',
        period: '2026-09',
        scheduleId: null,
        amount: new Decimal(100),
      },
    ]);
    const planSept = {
      batchSequence: 12,
      scheduleId: null,
      period: '2026-09',
    };
    const planAug = {
      batchSequence: 11,
      scheduleId: null,
      period: '2026-08',
    };
    expect(sumAcceptanceForPlan(planSept, agg).toNumber()).toBe(100);
    expect(sumAcceptanceForPlan(planAug, agg).toNumber()).toBe(0);
  });

  it('matches sub-batch plan by NT date within KH window (same đợt lớn)', () => {
    const plan = {
      batchSequence: 2,
      scheduleId: null,
      period: '2026-04',
      periodStartDate: new Date('2026-04-01T00:00:00.000Z'),
      periodEndDate: new Date('2026-04-30T23:59:59.999Z'),
    };
    const acceptance = {
      acceptanceNo: 'Đợt 2',
      period: '2026-06',
      scheduleId: null,
      amount: new Decimal(90_000_000),
      acceptanceDate: new Date('2026-04-15T00:00:00.000Z'),
    };
    expect(acceptanceMatchesRevenuePlan(acceptance, plan)).toBe(true);
    const agg = buildAcceptancePlanAggregates([acceptance]);
    expect(
      sumAcceptanceForPlan(plan, agg, [acceptance]).toNumber(),
    ).toBe(90_000_000);
  });

  it('matches by NT date in KH window without relying on acceptanceNo đợt', () => {
    const plan = {
      batchSequence: 2,
      scheduleId: null,
      period: '2026-08',
      periodStartDate: new Date('2026-05-06T00:00:00.000Z'),
      periodEndDate: new Date('2026-08-05T00:00:00.000Z'),
    };
    const acceptance = {
      acceptanceNo: 'Đợt 1',
      period: '2026-06',
      scheduleId: null,
      amount: new Decimal(43_960_000),
      acceptanceDate: new Date('2026-06-18T00:00:00.000Z'),
    };
    const agg = buildAcceptancePlanAggregates([acceptance]);
    const planPeriods = new Set(['2026-05', '2026-08', '2026-11']);
    expect(
      sumAcceptanceForPlan(plan, agg, [acceptance], planPeriods).toNumber(),
    ).toBe(43_960_000);
  });

  it('prefers scheduleId when set on plan', () => {
    const agg = buildAcceptancePlanAggregates([
      {
        acceptanceNo: 'X',
        period: '2026-09',
        scheduleId: 'sched-a',
        amount: new Decimal(50),
      },
    ]);
    expect(
      sumAcceptanceForPlan(
        { batchSequence: 1, scheduleId: 'sched-a', period: '2026-09' },
        agg,
      ).toNumber(),
    ).toBe(50);
  });
});
