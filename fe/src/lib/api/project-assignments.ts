import type { ProjectAssignment, ProjectAssignmentRole } from '@/lib/types';
import { apiFetch } from './client';

export type AssignmentPayload = {
  role: ProjectAssignmentRole;
  quantity?: number;
  startDate?: string;
  endDate?: string;
  note?: string;
};

export type AssignmentBulkItem = {
  role: ProjectAssignmentRole;
  quantity?: number;
  startDate?: string;
  endDate?: string;
  note?: string;
};

export const projectAssignmentsApi = {
  list(projectId: string) {
    return apiFetch<ProjectAssignment[]>(
      `/projects/${projectId}/assignments`,
    );
  },

  create(projectId: string, payload: AssignmentPayload) {
    return apiFetch<ProjectAssignment>(
      `/projects/${projectId}/assignments`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    );
  },

  bulkUpsert(projectId: string, items: AssignmentBulkItem[]) {
    return apiFetch<{
      count: number;
      created: number;
      updated: number;
      data: ProjectAssignment[];
    }>(`/projects/${projectId}/assignments/bulk`, {
      method: 'POST',
      body: JSON.stringify({ items }),
    });
  },

  update(id: string, payload: Partial<AssignmentPayload>) {
    return apiFetch<ProjectAssignment>(`/project-assignments/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  remove(id: string) {
    return apiFetch<ProjectAssignment>(`/project-assignments/${id}`, {
      method: 'DELETE',
    });
  },
};
