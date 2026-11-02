'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ContractStatus, Customer, Project } from '@/lib/types';
import { CONTRACT_STATUSES } from '@/lib/types';
import { customersApi, projectsApi } from '@/lib/api';
import {
  DASHBOARD_YEAR_MAX,
  DASHBOARD_YEAR_MIN,
  PERIOD_MONTH_MAX,
  PERIOD_MONTH_MIN,
} from '@/lib/period-input-bounds';
import type { DashboardQueryParams } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { contractStatusLabel } from '@/components/shared/status-badges';

const EMPTY: DashboardQueryParams = {};

export function DashboardFilters({
  value,
  onChange,
  onApply,
}: {
  value: DashboardQueryParams;
  onChange: (next: DashboardQueryParams) => void;
  onApply: () => void;
}) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  useEffect(() => {
    void (async () => {
      try {
        const [p, c] = await Promise.all([
          projectsApi.list({ limit: 500, page: 1 }),
          customersApi.list({ limit: 500, page: 1, partnerType: 'INVESTOR' }),
        ]);
        setProjects(p.data);
        setCustomers(c.data);
      } catch {
        setProjects([]);
        setCustomers([]);
      }
    })();
  }, []);

  const reset = useCallback(() => {
    onChange(EMPTY);
    onApply();
  }, [onChange, onApply]);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-sm font-semibold text-slate-900">Bộ lọc</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <div className="space-y-1">
          <Label htmlFor="filter-year">Năm</Label>
          <Input
            id="filter-year"
            type="number"
            min={DASHBOARD_YEAR_MIN}
            max={DASHBOARD_YEAR_MAX}
            placeholder="Tất cả"
            value={value.year ?? ''}
            onChange={(e) => {
              const raw = e.target.value.trim();
              onChange({
                ...value,
                year: raw ? Number(raw) : undefined,
              });
            }}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="filter-from-period">Từ tháng</Label>
          <Input
            id="filter-from-period"
            type="month"
            min={PERIOD_MONTH_MIN}
            max={PERIOD_MONTH_MAX}
            value={value.fromPeriod ?? ''}
            onChange={(e) =>
              onChange({
                ...value,
                fromPeriod: e.target.value || undefined,
              })
            }
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="filter-to-period">Đến tháng</Label>
          <Input
            id="filter-to-period"
            type="month"
            min={PERIOD_MONTH_MIN}
            max={PERIOD_MONTH_MAX}
            value={value.toPeriod ?? ''}
            onChange={(e) =>
              onChange({
                ...value,
                toPeriod: e.target.value || undefined,
              })
            }
          />
        </div>
        <div className="space-y-1">
          <Label>Dự án</Label>
          <Select
            value={value.projectId ?? ''}
            onChange={(e) =>
              onChange({
                ...value,
                projectId: e.target.value || undefined,
              })
            }
          >
            <option value="">Tất cả</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} — {p.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Khách hàng</Label>
          <Select
            value={value.customerId ?? ''}
            onChange={(e) =>
              onChange({
                ...value,
                customerId: e.target.value || undefined,
              })
            }
          >
            <option value="">Tất cả</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} — {c.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Trạng thái HĐ</Label>
          <Select
            value={value.contractStatus ?? ''}
            onChange={(e) =>
              onChange({
                ...value,
                contractStatus: (e.target.value as ContractStatus) || undefined,
              })
            }
          >
            <option value="">Tất cả</option>
            {CONTRACT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {contractStatusLabel[s]}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" onClick={onApply}>
          Áp dụng
        </Button>
        <Button size="sm" variant="outline" onClick={reset}>
          Reset
        </Button>
      </div>
    </div>
  );
}
