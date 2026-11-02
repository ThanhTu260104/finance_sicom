'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { projectsApi } from '@/lib/api';
import { formatDate } from '@/lib/format';
import type { Project, ProjectFinanceOverview } from '@/lib/types';
import { ProjectAcceptanceOverviewSection } from '@/components/projects/project-acceptance-overview-section';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ProjectStatusBadge } from '@/components/shared/status-badges';
import { ConfirmDeleteButton } from '@/components/shared/confirm-delete-button';
import { QueryState } from '@/components/shared/query-state';
import { ProjectAssignmentsSection } from '@/components/projects/project-assignments-section';
import { ProjectOperatingCostsSection } from '@/components/projects/project-operating-costs-section';
import { ProjectContractCostsSection } from '@/components/projects/project-contract-costs-section';
import { ProjectContractsSection } from '@/components/projects/project-contracts-section';
import { ContractExpiryHighlight } from '@/components/contracts/contract-expiry-highlight';
import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { WriteOnly } from '@/components/auth/auth-provider';

function InfoItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <div className="text-sm text-slate-900">{value || '—'}</div>
    </div>
  );
}

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [financeOverview, setFinanceOverview] =
    useState<ProjectFinanceOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [data, overview] = await Promise.all([
        projectsApi.get(params.id),
        projectsApi.getFinanceOverview(params.id),
      ]);
      setProject(data);
      setFinanceOverview(overview);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Không tải được dự án';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const handleDelete = async () => {
    try {
      await projectsApi.remove(params.id);
      toast.success('Đã xóa dự án');
      router.push('/projects');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Xóa thất bại');
    }
  };

  return (
    <div className="space-y-4">
      <QueryState
        loading={loading}
        error={error}
        empty={!project}
        emptyMessage="Không tìm thấy dự án."
        onRetry={load}
      >
        {project && (
          <>
            <Breadcrumbs
              items={[
                { label: 'Quản lý dự án' },
                { label: 'Dự án', href: '/projects' },
                { label: project.code },
              ]}
            />
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm text-slate-500">{project.code}</p>
                <h2 className="font-serif text-2xl font-semibold">
                  {project.name}
                </h2>
                <div className="mt-2">
                  <ProjectStatusBadge status={project.status} />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <WriteOnly>
                  <Button asChild variant="secondary">
                    <Link href={`/projects/${project.id}/edit`}>
                      <Pencil className="h-4 w-4" />
                      Sửa
                    </Link>
                  </Button>
                </WriteOnly>
                <ConfirmDeleteButton
                  onConfirm={handleDelete}
                  title="Xóa dự án?"
                  description={`Xóa mềm dự án ${project.code}.`}
                />
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Thông tin chung</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <InfoItem label="Mã dự án" value={project.code} />
                <InfoItem label="Tên dự án" value={project.name} />
                <InfoItem
                  label="Chủ đầu tư"
                  value={
                    project.customer
                      ? `${project.customer.code} — ${project.customer.name}`
                      : '—'
                  }
                />
                <InfoItem
                  label="Công ty ký HĐ"
                  value={
                    [
                      ...new Set(
                        (project.contracts ?? [])
                          .map((c) => c.company?.code)
                          .filter(Boolean),
                      ),
                    ].join(', ') || '—'
                  }
                />
                <InfoItem label="Loại dự án" value={project.projectType} />
                <InfoItem label="Địa điểm" value={project.location} />
                <InfoItem label="Địa chỉ" value={project.address} />
                <InfoItem
                  label="Ngày bắt đầu"
                  value={formatDate(project.startDate)}
                />
                <InfoItem
                  label="Ngày kết thúc"
                  value={formatDate(project.endDate)}
                />
                <InfoItem
                  label="Trạng thái"
                  value={<ProjectStatusBadge status={project.status} />}
                />
                <InfoItem label="Mô tả" value={project.description} />
              </CardContent>
            </Card>

            <ProjectAssignmentsSection
              projectId={project.id}
              projectCode={project.code}
              initial={project.assignments ?? []}
            />

            <ProjectOperatingCostsSection
              projectId={project.id}
              projectCode={project.code}
            />

            <ProjectContractCostsSection projectId={project.id} />

            <ContractExpiryHighlight contracts={project.contracts ?? []} />

            <ProjectContractsSection
              projectId={project.id}
              contracts={project.contracts ?? []}
              onChanged={() => void load()}
            />

            {financeOverview ? (
              <ProjectAcceptanceOverviewSection overview={financeOverview} />
            ) : null}
          </>
        )}
      </QueryState>
    </div>
  );
}
