import type { ProjectAssignment, ProjectAssignmentRole } from '@/lib/types';
import { apiFetch } from './client';

export type AssignmentPayload = {
  employeeId: string;
  role: ProjectAssignmentRole;
  startDate?: string;
  endDate?: string;
  isPrimary?: boolean;
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
