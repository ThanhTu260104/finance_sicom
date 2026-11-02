'use client';

import { useMemo, useState } from 'react';
import {
  aggregateTrendByQuarter,
  companyCurrentMonthFromSummary,
} from '@/lib/dashboard-scope';
import {
  dashboardPeriodValues,
  defaultDashboardFromPeriod,
  defaultDashboardToPeriod,
} from '@/lib/dashboard-period-options';
import { formatCurrencyVND, formatPeriod } from '@/lib/format';
import type { DashboardMonthlyPoint, DashboardOverview } from '@/lib/types';
import { CumulativeProgressDiagram } from '@/components/dashboard/cumulative-progress-diagram';
import { ContractMiniCard } from '@/components/dashboard/contract-mini-card';
import { sumDecimalIntStrings } from '@/lib/decimal-gap';
import {
  DashboardPieChart,
  DashboardTrendChart,
  filterMonthlyTrend,
} from '@/components/dashboard/dashboard-charts';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

function currentPeriod() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function shiftPeriod(period: string, deltaMonths: number) {
  const [y, m] = period.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + deltaMonths, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function CompanyAnalyticsPanel({ data }: { data: DashboardOverview }) {
  const periodChoices = useMemo(() => dashboardPeriodValues(), []);
  const [fromPeriod, setFromPeriod] = useState(defaultDashboardFromPeriod);
  const [toPeriod, setToPeriod] = useState(defaultDashboardToPeriod);
  const [granularity, setGranularity] = useState<'month' | 'quarter'>('month');
  const [view, setView] = useState<'plan' | 'contract'>('plan');
  const [chartView, setChartView] = useState<'bar' | 'line' | 'status'>('bar');
  const [cumulativeMode, setCumulativeMode] = useState(false);

  const filteredTrend = useMemo(() => {
    let base = filterMonthlyTrend(data.monthlyTrend, fromPeriod, toPeriod);
    if (granularity === 'quarter') base = aggregateTrendByQuarter(base);
    return base;
  }, [data.monthlyTrend, fromPeriod, toPeriod, granularity]);

  const cumulativeTrend = useMemo(() => {
    let planned = 0;
    let accepted = 0;
    let collected = 0;
    return filteredTrend.map((row): DashboardMonthlyPoint => {
      planned += Number(row.planned) || 0;
      accepted += Number(row.accepted) || 0;
      collected += Number(row.collected) || 0;
      return {
        period: row.period,
        planned: String(planned),
        accepted: String(accepted),
        collected: String(collected),
      };
    });
  }, [filteredTrend]);

  const currentMonth = companyCurrentMonthFromSummary(data.summary);
  const contracts = data.byContract ?? [];

  const applyPreset = (
    preset: 'all' | 'month' | 'previousMonth' | '3m' | '6m' | 'ytd',
  ) => {
    const first = periodChoices[0];
    const last = periodChoices[periodChoices.length - 1];
    const now = currentPeriod();
    if (preset === 'all') {
      setFromPeriod(first);
      setToPeriod(last);
      return;
    }
    if (preset === 'month') {
      const p = periodChoices.includes(now) ? now : last;
      setFromPeriod(p);
      setToPeriod(p);
      return;
    }
    if (preset === 'previousMonth') {
      const previous = shiftPeriod(now, -1);
      const p = periodChoices.includes(previous) ? previous : first;
      setFromPeriod(p);
      setToPeriod(p);
      return;
    }
    if (preset === '3m') {
      const from = shiftPeriod(last, -2);
      setFromPeriod(from < first ? first : from);
      setToPeriod(last);
      return;
    }
    if (preset === '6m') {
      const from = shiftPeriod(last, -5);
      setFromPeriod(from < first ? first : from);
      setToPeriod(last);
      return;
    }
    const yearStart = `${last.slice(0, 4)}-01`;
    setFromPeriod(yearStart < first ? first : yearStart);
    setToPeriod(last);
  };

  return (
    <details open className="rounded-xl border border-slate-200 bg-white">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-6 py-4 [&::-webkit-details-marker]:hidden">
        <div>
          <p className="text-base font-semibold text-slate-900">
            Toàn công ty · Kế hoạch / Nghiệm thu / Thu tiền
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Luôn theo cả công ty — không đổi khi chọn dự án bên dưới
          </p>
        </div>
        <span className="text-xs text-slate-500">Thu gọn / mở rộng</span>
      </summary>
      <CardContent className="space-y-4 px-6 pb-6 pt-0">
        <CumulativeProgressDiagram
          currentPeriod={data.summary.currentPeriod}
          plannedToDate={data.summary.plannedToDate}
          acceptedAmount={data.summary.submittedToDate}
          collectedAmount={sumDecimalIntStrings(
            data.byProject.map((p) => p.collected),
          )}
          contractValue={data.summary.contractValue}
        />
        <Card className="border-slate-200 bg-slate-50/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Thời gian tùy chỉnh</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { key: 'all', label: 'Tất cả' },
                  { key: 'month', label: 'Tháng này' },
                  { key: 'previousMonth', label: 'Tháng trước' },
                  { key: '3m', label: '3 tháng' },
                  { key: '6m', label: '6 tháng' },
                  { key: 'ytd', label: 'Từ đầu năm' },
                ] as const
              ).map((item) => (
                <Button
                  key={item.key}
                  size="sm"
                  variant="outline"
                  onClick={() => applyPreset(item.key)}
                >
                  {item.label}
                </Button>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1">
                <Label>Từ tháng</Label>
                <Select
                  value={fromPeriod}
                  onChange={(e) => {
                    const value = e.target.value;
                    setFromPeriod(value);
                    if (toPeriod && value > toPeriod) setToPeriod(value);
                  }}
                >
                  {periodChoices.map((period) => (
                    <option key={period} value={period}>
                      {formatPeriod(period)}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Đến tháng</Label>
                <Select
                  value={toPeriod}
                  onChange={(e) => {
                    const value = e.target.value;
                    setToPeriod(value);
                    if (fromPeriod && value < fromPeriod) setFromPeriod(value);
                  }}
                >
                  {periodChoices.map((period) => (
                    <option key={period} value={period}>
                      {formatPeriod(period)}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Nhóm</Label>
                <Select
                  value={granularity}
                  onChange={(e) =>
                    setGranularity(e.target.value as 'month' | 'quarter')
                  }
                >
                  <option value="month">Theo tháng</option>
                  <option value="quarter">Theo quý</option>
                </Select>
              </div>
              <div className="flex items-end text-sm text-slate-600">
                {formatPeriod(fromPeriod)} → {formatPeriod(toPeriod)} ·{' '}
                {filteredTrend.length} kỳ
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={view === 'plan' ? 'default' : 'outline'}
            onClick={() => setView('plan')}
          >
            Theo kế hoạch (tháng/quý)
          </Button>
          <Button
            size="sm"
            variant={view === 'contract' ? 'default' : 'outline'}
            onClick={() => setView('contract')}
          >
            Theo hợp đồng
          </Button>
        </div>

        {view === 'plan' ? (
          <div className="space-y-4">
            <p className="text-xs leading-relaxed text-slate-600">
              Kỳ hiện tại {formatPeriod(data.summary.currentPeriod)}: kế hoạch{' '}
              {formatCurrencyVND(currentMonth.planned)} · nghiệm thu{' '}
              {formatCurrencyVND(currentMonth.accepted)} (
              {currentMonth.acceptanceRatePercent}%) · thu tiền{' '}
              {formatCurrencyVND(currentMonth.collected)} (
              {currentMonth.collectionRatePercent}%)
            </p>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { key: 'bar', label: 'Cột' },
                  { key: 'line', label: 'Đường' },
                  { key: 'status', label: 'Cơ cấu trạng thái' },
                ] as const
              ).map((item) => (
                <Button
                  key={item.key}
                  size="sm"
                  variant={chartView === item.key ? 'default' : 'outline'}
                  onClick={() => setChartView(item.key)}
                >
                  {item.label}
                </Button>
              ))}
              <Button
                size="sm"
                variant={cumulativeMode ? 'default' : 'outline'}
                onClick={() => setCumulativeMode((v) => !v)}
              >
                Lũy kế
              </Button>
            </div>
            {chartView === 'status' ? (
              <DashboardPieChart data={data.statusBreakdown} />
            ) : (
              <DashboardTrendChart
                type={chartView}
                data={cumulativeMode ? cumulativeTrend : filteredTrend}
              />
            )}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {contracts.length === 0 ? (
              <p className="text-sm text-slate-500">Chưa có hợp đồng.</p>
            ) : (
              contracts.map((c) => (
                <ContractMiniCard
                  key={c.contractId}
                  contract={c}
                  showProject
                  currentPeriod={data.summary.currentPeriod}
                />
              ))
            )}
          </div>
        )}
      </CardContent>
    </details>
  );
}
