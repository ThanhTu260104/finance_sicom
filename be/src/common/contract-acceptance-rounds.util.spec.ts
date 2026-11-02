import { BillingCycle, DocumentStatus } from '@prisma/client';
import {
  countSubmittedDocumentAcceptanceRounds,
  expectedAcceptanceRounds,
  generatePeriodsForAcceptanceSchedule,
  generatePeriodsInBillingRange,
  resolveTotalAcceptanceRounds,
} from './contract-acceptance-rounds.util';
import { generateAcceptanceBatchWindows } from './utils/acceptance-batch.util';
import { AcceptancePaymentStatus, AcceptanceStatus } from '@prisma/client';

describe('contract acceptance rounds', () => {
  it('quarterly: rolling from contract start day (06/01 → đợt 1 kết thúc tháng 04)', () => {
    const periods = generatePeriodsForAcceptanceSchedule({
      startDate: new Date('2026-01-06T00:00:00.000Z'),
      durationYears: 1,
      billingCycle: BillingCycle.QUARTERLY,
    });
    expect(periods).toHaveLength(4);
    expect(periods[0]).toBe('2026-04');
    expect(periods[1]).toBe('2026-07');
    expect(periods[2]).toBe('2026-10');
    expect(periods[3]).toBe('2027-01');
  });

  it('monthly rolling VN: DB 19/02 17:00Z = hiển thị 20/02 → đợt 20/02–19/03', () => {
    const windows = generateAcceptanceBatchWindows({
      startDate: new Date('2026-02-19T17:00:00.000Z'),
      durationYears: 1,
      billingCycle: BillingCycle.MONTHLY,
    });
    expect(windows[0]?.periodStartDate.toISOString().slice(0, 10)).toBe(
      '2026-02-20',
    );
    expect(windows[0]?.periodEndDate.toISOString().slice(0, 10)).toBe(
      '2026-03-19',
    );
    expect(windows[1]?.periodStartDate.toISOString().slice(0, 10)).toBe(
      '2026-03-20',
    );
    expect(windows[1]?.periodEndDate.toISOString().slice(0, 10)).toBe(
      '2026-04-19',
    );
  });

  it('monthly rolling: đợt 1 = 20/01 → 19/02', () => {
    const windows = generateAcceptanceBatchWindows({
      startDate: new Date('2026-01-20T00:00:00.000Z'),
      durationYears: 1,
      billingCycle: BillingCycle.MONTHLY,
    });
    expect(windows[0]?.periodStartDate.toISOString().slice(0, 10)).toBe(
      '2026-01-20',
    );
    expect(windows[0]?.periodEndDate.toISOString().slice(0, 10)).toBe(
      '2026-02-19',
    );
    expect(windows[1]?.periodStartDate.toISOString().slice(0, 10)).toBe(
      '2026-02-20',
    );
    expect(windows[1]?.periodEndDate.toISOString().slice(0, 10)).toBe(
      '2026-03-19',
    );
  });

  it('monthly: rolling windows (20/01 → kỳ đầu = 02/2026)', () => {
    const periods = generatePeriodsForAcceptanceSchedule({
      startDate: new Date('2026-01-20T00:00:00.000Z'),
      durationYears: 1,
      billingCycle: BillingCycle.MONTHLY,
    });
    expect(periods).toHaveLength(12);
    expect(periods[0]).toBe('2026-02');
    expect(periods[1]).toBe('2026-03');
    expect(periods[11]).toBe('2027-01');
  });

  it('range: quarterly from user-selected from/to (not contract start)', () => {
    const periods = generatePeriodsInBillingRange({
      fromPeriod: '2026-11',
      toPeriod: '2027-10',
      billingCycle: BillingCycle.QUARTERLY,
    });
    expect(periods).toEqual(['2026-11', '2027-02', '2027-05', '2027-08']);
  });

  it('range: monthly inclusive', () => {
    const periods = generatePeriodsInBillingRange({
      fromPeriod: '2026-11',
      toPeriod: '2027-01',
      billingCycle: BillingCycle.MONTHLY,
    });
    expect(periods).toEqual(['2026-11', '2026-12', '2027-01']);
  });

  it('expected rounds from contract duration and billing cycle', () => {
    expect(
      expectedAcceptanceRounds({
        durationYears: 1,
        billingCycle: BillingCycle.MONTHLY,
      }),
    ).toBe(12);
    expect(
      expectedAcceptanceRounds({
        durationYears: 1,
        billingCycle: BillingCycle.QUARTERLY,
      }),
    ).toBe(4);
  });

  it('prefers contract expected total over schedule count', () => {
    expect(
      resolveTotalAcceptanceRounds({
        scheduleCount: 99,
        expectedRounds: 12,
        plannedInstallmentCount: 0,
      }),
    ).toBe(12);
  });

  it('counts submitted document rounds once per period', () => {
    const n = countSubmittedDocumentAcceptanceRounds([
      {
        scheduleId: null,
        period: '2025-01',
        status: AcceptanceStatus.APPROVED,
        documentStatus: DocumentStatus.SUBMITTED_UNPAID,
        paymentStatus: AcceptancePaymentStatus.WAITING_CLIENT_PAYMENT,
      },
      {
        scheduleId: null,
        period: '2025-01',
        status: AcceptanceStatus.APPROVED,
        documentStatus: DocumentStatus.SUBMITTED_UNPAID,
        paymentStatus: AcceptancePaymentStatus.COLLECTED,
      },
      {
        scheduleId: null,
        period: '2025-02',
        status: AcceptanceStatus.DRAFT,
        documentStatus: DocumentStatus.NOT_SUBMITTED,
        paymentStatus: AcceptancePaymentStatus.NOT_ACCEPTED,
      },
    ]);
    expect(n).toBe(1);
  });
});
