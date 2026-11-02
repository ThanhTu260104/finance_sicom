'use client';

import { useState } from 'react';
import type { DashboardOverview } from '@/lib/types';
import { ContractMiniCard } from '@/components/dashboard/contract-mini-card';
import { ProjectDashboardSummary } from '@/components/dashboard/project-dashboard-summary';
import { Button } from '@/components/ui/button';

export function ProjectAnalyticsPanel({ data }: { data: DashboardOverview }) {
  const [projectId, setProjectId] = useState('');

  const projectRow = data.byProject.find((p) => p.projectId === projectId);
  const scope = data.projectScopes?.find((s) => s.projectId === projectId);
  const projectContracts = (data.byContract ?? []).filter(
    (c) => c.projectId === projectId,
  );

  return (
    <details open className="rounded-xl border border-slate-200 bg-white">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-6 py-4 [&::-webkit-details-marker]:hidden">
        <div>
          <p className="text-base font-semibold text-slate-900">Theo dự án</p>
          <p className="mt-1 text-sm text-slate-500">
            Chọn dự án → sơ đồ tổng dự án, bên dưới là từng hợp đồng
          </p>
        </div>
        <span className="text-xs text-slate-500">Thu gọn / mở rộng</span>
      </summary>
      <div className="space-y-4 px-6 pb-6 pt-0">
        <div className="flex flex-wrap gap-2">
          {data.byProject.map((p) => (
            <Button
              key={p.projectId}
              size="sm"
              variant={projectId === p.projectId ? 'default' : 'outline'}
              onClick={() =>
                setProjectId((prev) =>
                  prev === p.projectId ? '' : p.projectId,
                )
              }
            >
              {p.projectCode}
            </Button>
          ))}
        </div>

        {!projectId || !projectRow ? (
          <p className="text-sm text-slate-500">
            Bấm mã dự án để xem tổng quan dự án và các hợp đồng.
          </p>
        ) : (
          <>
            <ProjectDashboardSummary
              project={projectRow}
              scope={scope}
              contracts={projectContracts}
              currentPeriod={data.summary.currentPeriod}
            />

            <div className="space-y-2">
              <p className="text-sm font-semibold text-slate-800">
                Hợp đồng trong dự án
              </p>
              {projectContracts.length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {projectContracts.map((c) => (
                    <ContractMiniCard
                      key={c.contractId}
                      contract={c}
                      currentPeriod={data.summary.currentPeriod}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">
                  Chưa có hợp đồng trong dự án này.
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </details>
  );
}
