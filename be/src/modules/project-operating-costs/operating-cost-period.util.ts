import { BadRequestException } from '@nestjs/common';

export function resolveOperatingCostPeriodRange(input: {
  year?: number;
  fromPeriod?: string;
  toPeriod?: string;
}): { fromPeriod?: string; toPeriod?: string } {
  let fromPeriod = input.fromPeriod;
  let toPeriod = input.toPeriod;

  if (input.year != null) {
    const yearStart = `${input.year}-01`;
    const yearEnd = `${input.year}-12`;
    fromPeriod = fromPeriod
      ? fromPeriod > yearStart
        ? fromPeriod
        : yearStart
      : yearStart;
    toPeriod = toPeriod
      ? toPeriod < yearEnd
        ? toPeriod
        : yearEnd
      : yearEnd;
  }

  if (fromPeriod && toPeriod && fromPeriod > toPeriod) {
    throw new BadRequestException('fromPeriod must be <= toPeriod');
  }

  return { fromPeriod, toPeriod };
}

export type PeriodFilterInput = {
  period?: string;
  fromPeriod?: string;
  toPeriod?: string;
  year?: number;
};

export function buildOperatingCostPeriodWhere(input: PeriodFilterInput):
  | { period: string }
  | { period: { gte?: string; lte?: string } }
  | Record<string, never> {
  if (input.period) {
    return { period: input.period };
  }

  const { fromPeriod, toPeriod } = resolveOperatingCostPeriodRange({
    year: input.year,
    fromPeriod: input.fromPeriod,
    toPeriod: input.toPeriod,
  });

  if (!fromPeriod && !toPeriod) {
    return {};
  }

  return {
    period: {
      ...(fromPeriod ? { gte: fromPeriod } : {}),
      ...(toPeriod ? { lte: toPeriod } : {}),
    },
  };
}
