import { BillingCycle } from '@prisma/client';
import {
  generateAcceptanceBatchWindows,
  generateRevenuePlanWindowsFromContract,
  splitBatchWindowIntoMonthlySlices,
} from './acceptance-batch.util';

describe('generateRevenuePlanWindowsFromContract', () => {
  it('splits quarterly batch into 3 monthly plan rows (same batchSequence)', () => {
    const batches = generateAcceptanceBatchWindows({
      startDate: new Date('2025-12-31T00:00:00.000Z'),
      durationYears: 1,
      billingCycle: BillingCycle.QUARTERLY,
    });
    expect(batches.length).toBeGreaterThanOrEqual(2);
    const batch2 = batches[1]!;
    const slices = splitBatchWindowIntoMonthlySlices(batch2, 3);
    expect(slices).toHaveLength(3);
    expect(slices.every((s) => s.batchSequence === batch2.batchSequence)).toBe(
      true,
    );
    const periods = new Set(slices.map((s) => s.period));
    expect(periods.size).toBe(3);

    const all = generateRevenuePlanWindowsFromContract({
      startDate: new Date('2025-12-31T00:00:00.000Z'),
      durationYears: 1,
      billingCycle: BillingCycle.QUARTERLY,
    });
    const batch2Rows = all.filter((w) => w.batchSequence === 2);
    expect(batch2Rows.length).toBe(3);
    expect(all.length).toBe(12);
    const allPeriods = all.map((w) => w.period);
    expect(new Set(allPeriods).size).toBe(allPeriods.length);
  });
});
