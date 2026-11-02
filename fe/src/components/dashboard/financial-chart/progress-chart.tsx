'use client';

import { useState } from 'react';
import { formatPercentDisplay } from '@/lib/format';
import {
  CHART_SERIES_ACCEPTANCE,
  CHART_SERIES_COLLECTION,
} from '@/lib/chart-colors';
import { ChartFullscreenModal } from './chart-fullscreen-modal';
import { ChartExpandButton } from './chart-expand-button';
import type { ChartContextItem } from './chart-context-bar';

export function FinancialProgressChart({
  acceptancePercent,
  collectionPercent,
  contractValueLabel,
  fullscreenContext,
}: {
  acceptancePercent: string;
  collectionPercent: string;
  contractValueLabel?: string;
  fullscreenContext?: ChartContextItem[];
}) {
  const [fullscreen, setFullscreen] = useState(false);
  const title = 'Tiến độ so với giá trị hợp đồng';

  return (
    <>
      <ProgressChartPanel
        acceptancePercent={acceptancePercent}
        collectionPercent={collectionPercent}
        contractValueLabel={contractValueLabel}
        onExpand={() => setFullscreen(true)}
      />
      <ChartFullscreenModal
        open={fullscreen}
        onClose={() => setFullscreen(false)}
        title={title}
        contextItems={fullscreenContext}
      >
        <ProgressChartPanel
          acceptancePercent={acceptancePercent}
          collectionPercent={collectionPercent}
          contractValueLabel={contractValueLabel}
          large
        />
      </ChartFullscreenModal>
    </>
  );
}

function ProgressChartPanel({
  acceptancePercent,
  collectionPercent,
  contractValueLabel,
  onExpand,
  large,
}: {
  acceptancePercent: string;
  collectionPercent: string;
  contractValueLabel?: string;
  onExpand?: () => void;
  large?: boolean;
}) {
  const a = Math.min(Math.max(Number(acceptancePercent) || 0, 0), 100);
  const c = Math.min(Math.max(Number(collectionPercent) || 0, 0), 100);
  const width = large ? 720 : 480;
  const barH = large ? 32 : 22;
  const gap = large ? 40 : 28;

  const shellClass = large
    ? 'space-y-4'
    : 'space-y-3 rounded-xl border border-slate-200 bg-white p-4';

  return (
    <div className={shellClass}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            Tiến độ so với giá trị hợp đồng
          </h3>
          {contractValueLabel ? (
            <p className="mt-1 text-xs text-slate-600">{contractValueLabel}</p>
          ) : null}
        </div>
        {onExpand ? <ChartExpandButton onClick={onExpand} /> : null}
      </div>
      <svg
        viewBox={`0 0 ${width} ${barH * 2 + gap + 24}`}
        className={large ? 'w-full max-w-3xl' : 'w-full max-w-xl'}
        role="img"
        aria-label="Tiến độ nghiệm thu và thu tiền"
      >
        <ProgressBar
          y={8}
          label="Nghiệm thu"
          percent={a}
          color={CHART_SERIES_ACCEPTANCE}
          width={width}
          barH={barH}
          display={formatPercentDisplay(acceptancePercent)}
          fontSize={large ? 14 : 12}
        />
        <ProgressBar
          y={8 + barH + gap}
          label="Thu tiền"
          percent={c}
          color={CHART_SERIES_COLLECTION}
          width={width}
          barH={barH}
          display={formatPercentDisplay(collectionPercent)}
          fontSize={large ? 14 : 12}
        />
      </svg>
    </div>
  );
}

function ProgressBar({
  y,
  label,
  percent,
  color,
  width,
  barH,
  display,
  fontSize = 12,
}: {
  y: number;
  label: string;
  percent: number;
  color: string;
  width: number;
  barH: number;
  display: string;
  fontSize?: number;
}) {
  const trackW = width - 120;
  const fillW = (percent / 100) * trackW;
  return (
    <g>
      <text
        x={0}
        y={y + barH - 6}
        className="fill-slate-700"
        fontSize={fontSize}
      >
        {label}
      </text>
      <rect
        x={100}
        y={y}
        width={trackW}
        height={barH}
        fill="#e2e8f0"
        rx={4}
      />
      <rect
        x={100}
        y={y}
        width={fillW}
        height={barH}
        fill={color}
        rx={4}
      />
      <text
        x={100 + trackW + 8}
        y={y + barH - 6}
        className="fill-slate-900 font-medium"
        fontSize={fontSize}
      >
        {display}
      </text>
    </g>
  );
}
