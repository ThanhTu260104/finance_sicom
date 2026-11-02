import { ContractStatus, Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { generatePeriodsBetween } from '../../common/utils/period.util';
import { REVENUE_CONTRACT_WHERE } from '../../common/contract-kind.util';
import { DashboardOverviewQueryDto } from './dto/dashboard-overview-query.dto';

export function resolveDashboardClock(now = new Date()) {
  const currentPeriod = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  const asOf = now.toISOString();
  const todayUtc = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  return { currentPeriod, asOf, todayUtc, now };
}

export function buildContractWhere(
  query: DashboardOverviewQueryDto,
): Prisma.ContractWhereInput {
  return {
    deletedAt: null,
    ...REVENUE_CONTRACT_WHERE,
    ...(query.projectId ? { projectId: query.projectId } : {}),
    ...(query.contractStatus ? { status: query.contractStatus } : {}),
    ...(query.customerId
      ? { project: { customerId: query.customerId, deletedAt: null } }
      : {}),
  };
}

export function periodFromUtcDate(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function earliestPeriod(periods: string[]): string | null {
  if (periods.length === 0) return null;
  return [...periods].sort()[0]!;
}

function latestPeriod(periods: string[]): string | null {
  if (periods.length === 0) return null;
  return [...periods].sort().reverse()[0]!;
}

/** Trục biểu đồ một HĐ: từ tháng bắt đầu HĐ (kể cả chưa có KH/NT), đến min(hôm nay, ngày kết thúc). */
export function resolveContractChartPeriodRange(input: {
  startDate: Date | null | undefined;
  endDate: Date | null | undefined;
  currentPeriod: string;
  periodKeys: string[];
  planPeriods?: string[];
}): { fromPeriod: string; toPeriod: string } {
  const startPeriod = input.startDate
    ? periodFromUtcDate(input.startDate)
    : null;
  const endPeriod = input.endDate ? periodFromUtcDate(input.endDate) : null;
  const earliestPlan = earliestPeriod(input.planPeriods ?? []);

  const fromPeriod =
    startPeriod ??
    earliestPlan ??
    earliestPeriod(input.periodKeys) ??
    `${input.currentPeriod.slice(0, 4)}-01`;

  let toPeriod = input.currentPeriod;
  if (endPeriod && endPeriod < toPeriod) {
    toPeriod = endPeriod;
  }

  if (fromPeriod > toPeriod) {
    toPeriod = fromPeriod;
  }

  return { fromPeriod, toPeriod };
}

/** Trục S-curve cả dự án: không sớm hơn tháng bắt đầu HĐ sớm nhất trong dự án. */
export function resolveProjectChartPeriodRange(input: {
  contracts: Array<{ startDate: Date | null; endDate: Date | null }>;
  currentPeriod: string;
  periodKeys: string[];
  query: DashboardOverviewQueryDto;
}): { fromPeriod: string; toPeriod: string } {
  const contractStarts = input.contracts
    .map((c) => (c.startDate ? periodFromUtcDate(c.startDate) : null))
    .filter((p): p is string => p != null);
  const earliestContractStart = earliestPeriod(contractStarts);

  const contractEnds = input.contracts
    .map((c) => (c.endDate ? periodFromUtcDate(c.endDate) : null))
    .filter((p): p is string => p != null);
  const latestContractEnd = latestPeriod(contractEnds);

  const base = resolveTrendPeriodRange({
    query: input.query,
    currentPeriod: input.currentPeriod,
    periodKeys: input.periodKeys,
  });

  let fromPeriod = base.fromPeriod;
  if (earliestContractStart && earliestContractStart < fromPeriod) {
    fromPeriod = earliestContractStart;
  }

  let toPeriod = base.toPeriod;
  if (latestContractEnd && latestContractEnd < toPeriod) {
    toPeriod = latestContractEnd;
  }

  if (fromPeriod > toPeriod) {
    toPeriod = fromPeriod;
  }

  return { fromPeriod, toPeriod };
}

export function resolveTrendPeriodRange(input: {
  query: DashboardOverviewQueryDto;
  currentPeriod: string;
  periodKeys: string[];
}): { fromPeriod: string; toPeriod: string } {
  const year = input.query.year;
  const yearStart = year ? `${year}-01` : null;
  const yearEnd = year ? `${year}-12` : null;

  let fromPeriod =
    input.query.fromPeriod ??
    yearStart ??
    input.periodKeys[0] ??
    `${input.currentPeriod.slice(0, 4)}-01`;
  let toPeriod = input.query.toPeriod ?? yearEnd ?? input.currentPeriod;

  if (yearStart && fromPeriod < yearStart) fromPeriod = yearStart;
  if (yearEnd && toPeriod > yearEnd) toPeriod = yearEnd;
  if (fromPeriod > toPeriod) {
    const swap = fromPeriod;
    fromPeriod = toPeriod;
    toPeriod = swap;
  }
  if (toPeriod > input.currentPeriod) {
    toPeriod = input.currentPeriod;
  }
  return { fromPeriod, toPeriod };
}

/** Lùi n tháng từ kỳ YYYY-MM (n >= 0). */
export function shiftPeriodMonths(period: string, deltaMonths: number): string {
  const [y, m] = period.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + deltaMonths, 1));
  const yy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${yy}-${mm}`;
}

export function listPeriodsInclusive(
  fromPeriod: string,
  toPeriod: string,
): string[] {
  const [fy, fm] = fromPeriod.split('-').map(Number);
  const [ty, tm] = toPeriod.split('-').map(Number);
  const start = new Date(Date.UTC(fy, fm - 1, 1));
  const end = new Date(Date.UTC(ty, tm - 1, 1));
  return generatePeriodsBetween(start, end);
}

export function sumMapForPeriod(
  map: Map<string, Decimal>,
  period: string,
): Decimal {
  return map.get(period) ?? new Decimal(0);
}

export function sumMapUpToPeriod(
  map: Map<string, Decimal>,
  throughPeriod: string,
): Decimal {
  let total = new Decimal(0);
  for (const [period, amount] of map) {
    if (period <= throughPeriod) {
      total = total.add(amount);
    }
  }
  return total;
}

export function addToPeriodMap(
  map: Map<string, Decimal>,
  period: string,
  amount: Decimal,
) {
  map.set(period, (map.get(period) ?? new Decimal(0)).add(amount));
}

export function contractTimeProgressPercent(
  startDate: Date | null | undefined,
  endDate: Date | null | undefined,
  todayUtc: Date,
): string | null {
  if (!startDate || !endDate) return null;
  const start = startDate.getTime();
  const end = endDate.getTime();
  if (end <= start) return '0.0';
  const t = Math.min(Math.max(todayUtc.getTime(), start), end);
  const pct = new Decimal(t - start).div(end - start).mul(100);
  return pct.toDecimalPlaces(1).toFixed(1);
}

/** Cảnh báo HĐ sắp hết hạn: ngày kết thúc trong khoảng này kể từ hôm nay (~6 tháng). */
export const EXPIRING_CONTRACT_WARN_DAYS = 180;

export function isExpiringSoon(
  status: ContractStatus,
  endDate: Date | null | undefined,
  todayUtc: Date,
  withinDays = EXPIRING_CONTRACT_WARN_DAYS,
): boolean {
  if (status !== ContractStatus.ACTIVE || !endDate) return false;
  const end = new Date(
    Date.UTC(
      endDate.getUTCFullYear(),
      endDate.getUTCMonth(),
      endDate.getUTCDate(),
    ),
  );
  const limit = new Date(todayUtc.getTime());
  limit.setUTCDate(limit.getUTCDate() + withinDays);
  return (
    end.getTime() >= todayUtc.getTime() && end.getTime() <= limit.getTime()
  );
}

export function pctOfValue(part: Decimal, whole: Decimal): string {
  if (whole.lte(0)) return '0.00';
  return part.div(whole).mul(100).toDecimalPlaces(2).toFixed(2);
}
