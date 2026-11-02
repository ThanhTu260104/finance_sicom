import { Decimal } from '@prisma/client/runtime/library';
import {
  buildAcceptancePlanAggregates,
  type AcceptanceForPlanMatchDetailed,
} from './acceptance-plan-match.util';
import { listOverdueUnacceptedAcceptanceBatches } from './overdue-acceptance-batch.util';

describe('listOverdueUnacceptedAcceptanceBatches', () => {
  it('flags batch 3 when window ended and no acceptance', () => {
    const plans = [
      {
        batchSequence: 3,
        scheduleId: null,
        period: '2026-07',
        periodStartDate: new Date('2026-07-01T00:00:00.000Z'),
        periodEndDate: new Date('2026-07-31T00:00:00.000Z'),
        plannedAmount: new Decimal(100),
      },
      {
        batchSequence: 3,
        scheduleId: null,
        period: '2026-08',
        periodStartDate: new Date('2026-08-01T00:00:00.000Z'),
        periodEndDate: new Date('2026-08-31T00:00:00.000Z'),
        plannedAmount: new Decimal(100),
      },
      {
        batchSequence: 3,
        scheduleId: null,
        period: '2026-09',
        periodStartDate: new Date('2026-09-01T00:00:00.000Z'),
        periodEndDate: new Date('2026-09-30T00:00:00.000Z'),
        plannedAmount: new Decimal(100),
      },
    ];
    const acceptances: AcceptanceForPlanMatchDetailed[] = [];
    const agg = buildAcceptancePlanAggregates([]);
    const notes = listOverdueUnacceptedAcceptanceBatches({
      plans,
      aggregates: agg,
      acceptances,
      contractPlanPeriods: new Set(plans.map((p) => p.period)),
      now: new Date('2026-10-09T12:00:00.000Z'),
    });
    expect(notes).toHaveLength(1);
    expect(notes[0]?.batchSequence).toBe(3);
    expect(notes[0]?.plannedAmount).toBe('300.00');
  });
});
