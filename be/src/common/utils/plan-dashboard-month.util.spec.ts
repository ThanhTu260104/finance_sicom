import { BillingCycle } from '@prisma/client';
import {
  planDashboardMonth,
  planDashboardMonthForBillingCycle,
  planMatchesDashboardMonth,
} from './plan-dashboard-month.util';

describe('planDashboardMonth', () => {
  it('uses start month for quarterly batch (An Bình đợt 4 pattern)', () => {
    const month = planDashboardMonth({
      period: '2026-12',
      periodStartDate: new Date('2026-10-01T00:00:00.000Z'),
    });
    expect(month).toBe('2026-10');
    expect(
      planMatchesDashboardMonth(
        {
          period: '2026-12',
          periodStartDate: new Date('2026-10-01T00:00:00.000Z'),
        },
        '2026-10',
      ),
    ).toBe(true);
    expect(
      planMatchesDashboardMonth(
        {
          period: '2026-12',
          periodStartDate: new Date('2026-10-01T00:00:00.000Z'),
        },
        '2026-12',
      ),
    ).toBe(false);
  });

  it('uses plan.period for MONTHLY (kỳ NT trùng period, không lệch startDate)', () => {
    const plan = {
      period: '2026-09',
      periodStartDate: new Date('2026-08-10T00:00:00.000Z'),
    };
    expect(
      planDashboardMonthForBillingCycle(plan, BillingCycle.MONTHLY),
    ).toBe('2026-09');
    expect(
      planMatchesDashboardMonth(plan, '2026-09', BillingCycle.MONTHLY),
    ).toBe(true);
    expect(
      planMatchesDashboardMonth(plan, '2026-08', BillingCycle.MONTHLY),
    ).toBe(false);
  });
});
