import { collectionOccurrencePeriod } from './collection-reporting-period.util';

describe('collectionOccurrencePeriod', () => {
  it('uses collectionDate in VN timezone', () => {
    expect(
      collectionOccurrencePeriod({
        collectionDate: new Date('2026-09-16T00:00:00.000Z'),
        period: '2026-06',
      }),
    ).toBe('2026-09');
  });

  it('falls back to period when no date', () => {
    expect(
      collectionOccurrencePeriod({
        collectionDate: null,
        period: '2026-06',
      }),
    ).toBe('2026-06');
  });
});
