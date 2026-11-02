import {
  buildContractBatchTrend,
  createContractBatchResolver,
  mergeContractBatchTrends,
} from './contract-batch-trend.util';

const d = (ymd: string) => new Date(`${ymd}T00:00:00.000Z`);

/** Dữ liệu thật HĐ 1203/2026/HĐCCDV (ĐH Mỹ Thuật, chu kỳ quý, đợt 1 = 12/03 → 11/06) */
function myThuatPlans() {
  const rows: Array<[number, string, string, string]> = [
    [1, '2026-03', '2026-03-12', '2026-04-11'],
    [1, '2026-04', '2026-04-12', '2026-05-11'],
    [1, '2026-05', '2026-05-12', '2026-06-11'],
    [2, '2026-06', '2026-06-12', '2026-07-11'],
    [2, '2026-07', '2026-07-12', '2026-08-11'],
    [2, '2026-08', '2026-08-12', '2026-09-11'],
  ];
  return rows.map(([batchSequence, period, start, end]) => ({
    batchSequence,
    period,
    periodStartDate: d(start),
    periodEndDate: d(end),
    plannedAmount: '20000000',
  }));
}

describe('buildContractBatchTrend', () => {
  const acceptances = [
    // Đợt 1 ghi kỳ 2026-03, ngày NT 12/06 — phải vào đợt 1
    { id: 'a1', acceptanceNo: 'Đợt 1', period: '2026-03', amount: '60000000' },
    // Đợt 2 ghi kỳ 2026-08 (cuối đợt) — vẫn phải vào đợt 2
    { id: 'a2', acceptanceNo: 'Đợt 2', period: '2026-08', amount: '60000000' },
  ];

  const result = buildContractBatchTrend({
    plans: myThuatPlans(),
    windows: [],
    acceptances,
    allAcceptances: acceptances,
    collections: [
      { collectionNo: 'NT/a1', period: '2026-03', amount: '60000000' },
      { collectionNo: 'NT/a2', period: '2026-08', amount: '60000000' },
    ],
    monthlyFinancials: [],
    now: d('2026-07-01'),
  });

  it('một điểm cho mỗi đợt, gộp 3 tháng con', () => {
    expect(result.points.map((p) => p.label)).toEqual(['Đợt 1', 'Đợt 2']);
    expect(result.points[0].period).toBe('2026-03');
    expect(result.points[0].periodEndDate.slice(0, 10)).toBe('2026-06-11');
    expect(result.points[0].plannedAcceptance).toBe('60000000');
  });

  it('NT và thu nằm đúng đợt (không theo ngày / tháng)', () => {
    for (const p of result.points) {
      expect(p.actualAcceptance).toBe('60000000');
      expect(p.actualCollection).toBe('60000000');
      expect(p.acceptanceGapPeriod).toBe('0');
    }
    expect(result.points[1].actualAcceptanceCumulative).toBe('120000000');
  });

  it('đợt hiện tại theo ngày hôm nay', () => {
    expect(result.currentBatchPeriod).toBe('2026-06');
  });

  it('thu tay không gắn NT → theo kỳ, đợt bắt đầu gần nhất', () => {
    const r = buildContractBatchTrend({
      plans: myThuatPlans(),
      windows: [],
      acceptances: [],
      allAcceptances: [],
      collections: [{ collectionNo: 'PT-01', period: '2026-07', amount: '5' }],
      monthlyFinancials: [{ period: '2026-04', actualWorkAmount: '7' }],
      now: d('2026-07-01'),
    });
    expect(r.points[1].actualCollection).toBe('5');
    expect(r.points[0].actualWork).toBe('7');
  });

  it('bảng tháng dự án / công ty: đợt dồn vào tháng kết thúc đợt', () => {
    const r = createContractBatchResolver({
      plans: myThuatPlans(),
      windows: [],
      acceptances: [],
    })!;
    // 1.1 (12/03) và 1.3 (12/05) đều thuộc đợt 1 → tháng kết thúc 06/2026
    expect(
      r.endPeriodOf(r.forPlan({ period: '2026-03', batchSequence: 1 })),
    ).toBe('2026-06');
    expect(
      r.endPeriodOf(r.forPlan({ period: '2026-05', batchSequence: 1 })),
    ).toBe('2026-06');
    // NT "Đợt 2" ghi kỳ 2026-06 → tháng kết thúc đợt 2 (09/2026)
    expect(
      r.endPeriodOf(
        r.forAcceptance({ acceptanceNo: 'Đợt 2', period: '2026-06' }),
      ),
    ).toBe('2026-09');
  });

  it('gộp dự án: cùng lịch đợt → cộng; khác lịch → null', () => {
    const twice = mergeContractBatchTrends([result, result])!;
    expect(twice.points[0].plannedAcceptance).toBe('120000000');
    expect(twice.points[1].actualAcceptanceCumulative).toBe('240000000');
    const other = buildContractBatchTrend({
      plans: myThuatPlans().slice(0, 3),
      windows: [],
      acceptances: [],
      allAcceptances: [],
      collections: [],
      monthlyFinancials: [],
      now: d('2026-07-01'),
    });
    expect(mergeContractBatchTrends([result, other])).toBeNull();
  });
});
