'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';
import { projectsApi } from '@/lib/api';
import type { Project } from '@/lib/types';
import { ProjectForm } from '@/components/projects/project-form';
import { QueryState } from '@/components/shared/query-state';
import { Breadcrumbs } from '@/components/layout/breadcrumbs';

export default function EditProjectPage() {
  const params = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await projectsApi.get(params.id);
      setProject(data);
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

  return (
    <div className="space-y-4">
      <Breadcrumbs
        items={[
          { label: 'Quản lý dự án' },
          { label: 'Dự án', href: '/projects' },
          ...(project
            ? [
                { label: project.code, href: `/projects/${project.id}` },
                { label: 'Sửa' },
              ]
            : [{ label: 'Sửa dự án' }]),
        ]}
      />
      <h2 className="font-serif text-2xl font-semibold">Sửa dự án</h2>
      <QueryState
        loading={loading}
        error={error}
        empty={!project}
        emptyMessage="Không tìm thấy dự án."
        onRetry={load}
      >
        {project && (
          <ProjectForm projectId={project.id} initial={project} />
        )}
      </QueryState>
    </div>
  );
}
