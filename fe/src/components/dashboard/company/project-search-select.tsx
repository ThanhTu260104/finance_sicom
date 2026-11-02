'use client';

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import type { DashboardByProjectRow } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';

export function ProjectSearchSelect({
  projects,
  selectedId,
  onSelect,
}: {
  projects: DashboardByProjectRow[];
  selectedId: string | null;
  onSelect: (projectId: string | null) => void;
}) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = [...projects].sort((a, b) =>
      a.projectCode.localeCompare(b.projectCode),
    );
    if (!q) return list;
    return list.filter(
      (p) =>
        p.projectCode.toLowerCase().includes(q) ||
        p.projectName.toLowerCase().includes(q) ||
        (p.customerName?.toLowerCase().includes(q) ?? false),
    );
  }, [projects, query]);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
      <div className="min-w-[12rem] flex-1 space-y-1.5 sm:max-w-xs">
        <Label htmlFor="project-search" className="text-xs text-slate-600">
          Tìm dự án
        </Label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            id="project-search"
            placeholder="Mã, tên, khách hàng…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>
      <div className="min-w-[16rem] flex-[2] space-y-1.5">
        <Label htmlFor="project-pick" className="text-xs text-slate-600">
          Chọn dự án
        </Label>
        <Select
          id="project-pick"
          value={selectedId ?? ''}
          onChange={(e) => onSelect(e.target.value ? e.target.value : null)}
        >
          <option value="">— Chọn dự án —</option>
          {filtered.map((p) => (
            <option key={p.projectId} value={p.projectId}>
              {p.projectCode} — {p.projectName}
              {p.customerName ? ` (${p.customerName})` : ''}
            </option>
          ))}
        </Select>
        {query && filtered.length === 0 ? (
          <p className="text-xs text-slate-500">Không có dự án khớp tìm kiếm.</p>
        ) : null}
      </div>
      {selectedId ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="sm:mb-0.5"
          onClick={() => onSelect(null)}
        >
          Bỏ chọn
        </Button>
      ) : null}
    </div>
  );
}
