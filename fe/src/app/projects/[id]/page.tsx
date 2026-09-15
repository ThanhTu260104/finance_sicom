'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Pencil, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { projectsApi } from '@/lib/api';
import { formatCurrencyVND, formatDate } from '@/lib/format';
import type { Project, ProjectFinanceOverview } from '@/lib/types';
import { ProjectAcceptanceOverviewSection } from '@/components/projects/project-acceptance-overview-section';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ContractStatusBadge,
  ProjectStatusBadge,
  billingCycleLabel,
  contractTypeLabel,
} from '@/components/shared/status-badges';
import { ConfirmDeleteButton } from '@/components/shared/confirm-delete-button';
import { QueryState } from '@/components/shared/query-state';
import { ProjectAssignmentsSection } from '@/components/projects/project-assignments-section';
import { Breadcrumbs } from '@/components/layout/breadcrumbs';

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
                <Button asChild variant="secondary">
                  <Link href={`/projects/${project.id}/edit`}>
                    <Pencil className="h-4 w-4" />
                    Sửa
                  </Link>
                </Button>
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
                  label="Khách hàng"
                  value={
                    project.customer
                      ? `${project.customer.code} — ${project.customer.name}`
                      : '—'
                  }
                />
                <InfoItem
                  label="Công ty"
                  value={
                    <span className="font-mono text-xs">{project.companyId}</span>
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
              initial={project.assignments ?? []}
            />

            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-3">
                <CardTitle className="text-base">Hợp đồng</CardTitle>
                <Button asChild size="sm">
                  <Link href={`/contracts/new?projectId=${project.id}`}>
                    <Plus className="h-4 w-4" />
                    Thêm hợp đồng
                  </Link>
                </Button>
              </CardHeader>
              <CardContent>
                {(project.contracts ?? []).length === 0 ? (
                  <p className="text-sm text-slate-500">Chưa có hợp đồng.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Số hợp đồng</TableHead>
                          <TableHead>Tên hợp đồng</TableHead>
                          <TableHead>Giá trị</TableHead>
                          <TableHead>Loại hợp đồng</TableHead>
                          <TableHead>Ngày ký</TableHead>
                          <TableHead>Chu kỳ nghiệm thu</TableHead>
                          <TableHead>Trạng thái</TableHead>
                          <TableHead className="text-right">Thao tác</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(project.contracts ?? []).map((contract) => (
                          <TableRow key={contract.id}>
                            <TableCell className="font-medium">
                              {contract.contractNo}
                            </TableCell>
                            <TableCell>{contract.name}</TableCell>
                            <TableCell>
                              {formatCurrencyVND(contract.contractValue)}
                            </TableCell>
                            <TableCell>
                              {contractTypeLabel[contract.contractType]}
                            </TableCell>
                            <TableCell>
                              {formatDate(contract.signedDate)}
                            </TableCell>
                            <TableCell>
                              {billingCycleLabel[contract.billingCycle]}
                            </TableCell>
                            <TableCell>
                              <ContractStatusBadge status={contract.status} />
                            </TableCell>
                            <TableCell>
                              <div className="flex justify-end">
                                <Button asChild size="sm" variant="outline">
                                  <Link href={`/contracts/${contract.id}`}>
                                    Xem hợp đồng
                                  </Link>
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            {financeOverview ? (
              <ProjectAcceptanceOverviewSection overview={financeOverview} />
            ) : null}
          </>
        )}
      </QueryState>
    </div>
  );
}
