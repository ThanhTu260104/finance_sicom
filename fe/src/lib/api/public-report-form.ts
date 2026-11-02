import type {
  ProjectReportSubmissionDetail,
  ProjectReportSubmissionPrefill,
} from '@/lib/types';
import { apiFetch, buildQuery } from './client';
import type { CreateProjectReportSubmissionPayload } from './project-report-submissions';

export type PublicReportFormProject = {
  id: string;
  code: string;
  name: string;
  projectType: string | null;
  projectManagerName: string | null;
};

const publicOpts = { skipAuth: true as const };

export const publicReportFormApi = {
  listProjects() {
    return apiFetch<PublicReportFormProject[]>(
      '/public/report-form/projects',
      publicOpts,
    );
  },

  prefill(projectId: string, period: string) {
    return apiFetch<ProjectReportSubmissionPrefill>(
      `/projects/${projectId}/report-submission-prefill${buildQuery({ period })}`,
      publicOpts,
    );
  },

  create(payload: CreateProjectReportSubmissionPayload) {
    if (payload.fileIds?.length) {
      return apiFetch<ProjectReportSubmissionDetail>(
        '/project-report-submissions/submit',
        {
          method: 'POST',
          body: JSON.stringify({
            projectId: payload.projectId,
            period: payload.period,
            title: payload.title,
            note: payload.note,
            lines: payload.lines,
            fileIds: payload.fileIds,
          }),
          ...publicOpts,
        },
      );
    }

    const files = payload.files ?? [];
    const form = new FormData();
    form.append(
      'payload',
      JSON.stringify({
        projectId: payload.projectId,
        period: payload.period,
        title: payload.title,
        note: payload.note,
        lines: payload.lines,
      }),
    );
    for (const file of files) {
      form.append('files', file);
    }
    return apiFetch<ProjectReportSubmissionDetail>(
      '/project-report-submissions',
      {
        method: 'POST',
        body: form,
        timeoutMs: 120_000,
        ...publicOpts,
      },
    );
  },
};
