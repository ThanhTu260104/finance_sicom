import {
  resolveContractChartPeriodRange,
  resolveProjectChartPeriodRange,
} from './dashboard-aggregation.helpers';

describe('resolveContractChartPeriodRange', () => {
  it('starts at contract start month even when plans begin later', () => {
    const { fromPeriod, toPeriod } = resolveContractChartPeriodRange({
      startDate: new Date(Date.UTC(2026, 0, 15)),
      endDate: new Date(Date.UTC(2026, 11, 31)),
      currentPeriod: '2026-09',
      periodKeys: ['2026-03', '2026-04'],
    });
    expect(fromPeriod).toBe('2026-01');
    expect(toPeriod).toBe('2026-09');
  });

  it('caps toPeriod at contract end', () => {
    const { toPeriod } = resolveContractChartPeriodRange({
      startDate: new Date(Date.UTC(2025, 0, 1)),
      endDate: new Date(Date.UTC(2026, 1, 28)),
      currentPeriod: '2026-09',
      periodKeys: ['2026-02'],
    });
    expect(toPeriod).toBe('2026-02');
  });
});

describe('resolveProjectChartPeriodRange', () => {
  it('extends chart to earliest contract start without year filter', () => {
    const { fromPeriod } = resolveProjectChartPeriodRange({
      contracts: [
        {
          startDate: new Date(Date.UTC(2026, 0, 1)),
          endDate: new Date(Date.UTC(2026, 11, 31)),
        },
        {
          startDate: new Date(Date.UTC(2026, 2, 1)),
          endDate: new Date(Date.UTC(2026, 11, 31)),
        },
      ],
      currentPeriod: '2026-09',
      periodKeys: ['2026-03', '2026-04'],
      query: {},
    });
    expect(fromPeriod).toBe('2026-01');
  });
});
