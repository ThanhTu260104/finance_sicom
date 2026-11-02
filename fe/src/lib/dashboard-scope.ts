import { formatPeriod } from '@/lib/format';
import type { DashboardMonthlyPoint, DashboardOverview } from '@/lib/types';

export function formatTrendPeriodLabel(period: string) {
  if (period.includes('-Q')) return formatQuarterKey(period);
  return formatPeriod(period);
}

export function quarterKey(period: string) {
  const [y, m] = period.split('-').map(Number);
  const q = Math.ceil(m / 3);
  return `${y}-Q${q}`;
}

export function formatQuarterKey(key: string) {
  const [y, qPart] = key.split('-');
  return `${qPart} ${y}`;
}

function addAmount(a: string, b: string) {
  return String(Number(a || 0) + Number(b || 0));
}

export function aggregateTrendByQuarter(
  points: DashboardMonthlyPoint[],
): DashboardMonthlyPoint[] {
  const map = new Map<string, DashboardMonthlyPoint>();
  for (const p of points) {
    const key = quarterKey(p.period);
    const prev = map.get(key);
    if (!prev) {
      map.set(key, {
        period: key,
        planned: p.planned,
        accepted: p.accepted,
        collected: p.collected,
        actualWork: p.actualWork ?? '0',
      });
    } else {
      map.set(key, {
        period: key,
        planned: addAmount(prev.planned, p.planned),
        accepted: addAmount(prev.accepted, p.accepted),
        collected: addAmount(prev.collected, p.collected),
        actualWork: addAmount(prev.actualWork ?? '0', p.actualWork ?? '0'),
      });
    }
  }
  return Array.from(map.values()).sort((a, b) =>
    a.period.localeCompare(b.period),
  );
}

export function companyCurrentMonthFromSummary(
  summary: DashboardOverview['summary'],
) {
  return {
    planned: summary.currentPlanned,
    actualWork: summary.currentActualWork,
    accepted: summary.currentAccepted,
    pendingSubmission: summary.currentPendingSubmission,
    unaccepted: summary.currentUnaccepted,
    unperformed: summary.currentUnperformed,
    collected: summary.currentCollected,
    outstandingCollection: summary.currentOutstandingCollection,
    executionRatePercent: summary.currentExecutionRatePercent,
    acceptanceRatePercent: summary.currentAcceptanceRatePercent,
    collectionRatePercent: summary.currentCollectionRatePercent,
  };
}
