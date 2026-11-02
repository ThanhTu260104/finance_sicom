import { acceptanceOccurrencePeriod } from './acceptance-reporting-period.util';

describe('acceptanceOccurrencePeriod', () => {
  it('uses acceptanceDate month (VN)', () => {
    expect(
      acceptanceOccurrencePeriod({
        acceptanceDate: new Date('2026-09-16T00:00:00.000Z'),
        period: '2026-06',
      }),
    ).toBe('2026-09');
  });

  it('falls back to invoiceDate then plan period', () => {
    expect(
      acceptanceOccurrencePeriod({
        acceptanceDate: null,
        invoiceDate: new Date('2026-05-11T00:00:00.000Z'),
        period: '2026-03',
      }),
    ).toBe('2026-05');
    expect(
      acceptanceOccurrencePeriod({
        period: '2026-03',
      }),
    ).toBe('2026-03');
  });
});
