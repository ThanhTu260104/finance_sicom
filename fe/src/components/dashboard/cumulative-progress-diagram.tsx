'use client';

import { formatCurrencyVND, formatPeriod } from '@/lib/format';
import {
  formatAchievementPercent,
  isPositiveDecimal,
  percentOfReference,
  subtractDecimalInt,
} from '@/lib/decimal-gap';
import { CHART_BLUE, CHART_GREEN, CHART_SLATE } from '@/lib/chart-colors';

const BIGINT_ZERO = BigInt(0);

function ProgressRow({
  label,
  amount,
  barPercent,
  barColor,
  achievementLabel,
  hint,
  hintClassName,
}: {
  label: string;
  amount: string;
  barPercent: number;
  barColor: string;
  achievementLabel: string;
  hint?: string;
  hintClassName?: string;
}) {
  const width = Math.min(Math.max(barPercent, 0), 100);
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm font-bold text-slate-900">{label}</span>
        <div className="flex flex-wrap items-baseline justify-end gap-2 text-sm tabular-nums">
          <span className="font-bold text-slate-900">{achievementLabel}</span>
          <span className="font-semibold text-slate-700">
            {formatCurrencyVND(amount)}
          </span>
        </div>
      </div>
      <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full transition-[width]"
          style={{ width: `${width}%`, backgroundColor: barColor }}
        />
      </div>
      {hint ? (
        <p className={`text-xs leading-relaxed ${hintClassName ?? 'text-slate-500'}`}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Sơ đồ lũy kế: kế hoạch đến kỳ (mốc 100%) → nghiệm thu thực tế → tiền thu.
 */
export function CumulativeProgressDiagram({
  currentPeriod,
  plannedToDate,
  acceptedAmount,
  collectedAmount,
  contractValue,
  compact,
}: {
  currentPeriod?: string | null;
  plannedToDate: string;
  acceptedAmount: string;
  collectedAmount: string;
  contractValue?: string;
  compact?: boolean;
}) {
  const periodLabel = currentPeriod ? formatPeriod(currentPeriod) : 'kỳ hiện tại';
  const reference =
    isPositiveDecimal(plannedToDate)
      ? plannedToDate
      : contractValue && isPositiveDecimal(contractValue)
        ? contractValue
        : '0';

  const hasReference = isPositiveDecimal(reference);
  if (!hasReference && !isPositiveDecimal(acceptedAmount)) {
    return (
      <p className="text-xs text-slate-500">
        Chưa có kế hoạch nghiệm thu lũy kế đến {periodLabel} để hiển thị sơ đồ.
      </p>
    );
  }

  const shortfallAcceptance = subtractDecimalInt(reference, acceptedAmount);
  const shortfallCollectionVsPlan = subtractDecimalInt(reference, collectedAmount);
  const shortfallCollectionVsAccepted = subtractDecimalInt(
    acceptedAmount,
    collectedAmount,
  );

  const acceptanceHint =
    shortfallAcceptance > BIGINT_ZERO
      ? `Chậm so với kế hoạch: ${formatCurrencyVND(shortfallAcceptance.toString())}`
      : shortfallAcceptance < BIGINT_ZERO
        ? `Vượt kế hoạch: ${formatCurrencyVND((-shortfallAcceptance).toString())}`
        : 'Bằng kế hoạch nghiệm thu lũy kế đến kỳ';

  const collectionHints: string[] = [];
  if (shortfallCollectionVsAccepted > BIGINT_ZERO) {
    collectionHints.push(
      `Chưa thu trên phần đã nghiệm thu: ${formatCurrencyVND(shortfallCollectionVsAccepted.toString())}`,
    );
  }
  if (shortfallCollectionVsPlan > BIGINT_ZERO) {
    collectionHints.push(
      `Chậm thu so với kế hoạch: ${formatCurrencyVND(shortfallCollectionVsPlan.toString())}`,
    );
  }
  if (collectionHints.length === 0 && isPositiveDecimal(collectedAmount)) {
    collectionHints.push(
      'Tiền thu bám sát hoặc vượt mốc so với kế hoạch / nghiệm thu',
    );
  }

  const planAchievement = '100,0%';
  const acceptanceAchievement = formatAchievementPercent(acceptedAmount, reference);
  const collectionAchievement = formatAchievementPercent(collectedAmount, reference);

  return (
    <div
      className={
        compact
          ? 'space-y-3.5'
          : 'space-y-3.5 rounded-lg border border-slate-200 bg-white p-4'
      }
    >
      <div>
        <p className="text-sm font-bold text-slate-900">
          Sơ đồ lũy kế đến {periodLabel}
        </p>
        {!compact ? (
          <p className="mt-1 text-xs leading-relaxed text-slate-600">
            Thanh 100% là tổng kế hoạch nghiệm thu lũy kế đến tháng hiện tại.
            Phần trăm là mức đạt được so với mốc đó.
          </p>
        ) : null}
      </div>

      <ProgressRow
        label="① Kế hoạch nghiệm thu lũy kế đến kỳ (mốc)"
        amount={reference}
        barPercent={100}
        barColor={CHART_SLATE}
        achievementLabel={planAchievement}
        hint="Tổng các đợt kế hoạch từ đầu hợp đồng đến hết tháng hiện tại"
      />
      <ProgressRow
        label="② Nghiệm thu thực tế (đã nộp hồ sơ)"
        amount={acceptedAmount}
        barPercent={percentOfReference(acceptedAmount, reference)}
        barColor={CHART_GREEN}
        achievementLabel={acceptanceAchievement}
        hint={acceptanceHint}
        hintClassName={
          shortfallAcceptance > BIGINT_ZERO ? 'text-red-700' : 'text-emerald-800'
        }
      />
      <ProgressRow
        label="③ Tiền đã thu"
        amount={collectedAmount}
        barPercent={percentOfReference(collectedAmount, reference)}
        barColor={CHART_BLUE}
        achievementLabel={collectionAchievement}
        hint={collectionHints.join(' · ')}
        hintClassName={
          shortfallCollectionVsPlan > BIGINT_ZERO
            ? 'text-orange-800'
            : 'text-emerald-800'
        }
      />

      {!compact &&
      shortfallAcceptance > BIGINT_ZERO &&
      shortfallCollectionVsAccepted > BIGINT_ZERO ? (
        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-700">
          <span className="font-semibold">Tóm tắt:</span> Kế hoạch đến kỳ{' '}
          {formatCurrencyVND(reference)} · Nghiệm thu{' '}
          {formatCurrencyVND(acceptedAmount)}{' '}
          <span className="font-medium text-red-700">
            (thiếu {formatCurrencyVND(shortfallAcceptance.toString())})
          </span>{' '}
          · Thu {formatCurrencyVND(collectedAmount)}{' '}
          <span className="font-medium text-orange-800">
            (chưa thu{' '}
            {formatCurrencyVND(shortfallCollectionVsAccepted.toString())} trên
            phần đã nghiệm thu)
          </span>
        </div>
      ) : null}
    </div>
  );
}
