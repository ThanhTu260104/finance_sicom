import type {
  ProjectReportSubmissionDetail,
  ProjectReportSubmissionListItem,
  ProjectReportSubmissionPeriodSummary,
  ProjectReportSubmissionPrefill,
} from '@/lib/types';
import { API_URL, apiFetch, buildQuery } from './client';

export type CreateProjectReportSubmissionPayload = {
  projectId: string;
  period: string;
  title?: string;
  note?: string;
  lines: Array<{
    contractId: string;
    reportedPlannedAmount: number;
    note?: string;
  }>;
  /** @deprecated Dùng fileIds sau upload staged */
  files?: File[];
  fileIds?: string[];
};

export const projectReportSubmissionsApi = {
  prefill(projectId: string, period: string) {
    return apiFetch<ProjectReportSubmissionPrefill>(
      `/projects/${projectId}/report-submission-prefill${buildQuery({ period })}`,
    );
  },

  periodSummary(period: string) {
    return apiFetch<ProjectReportSubmissionPeriodSummary>(
      `/project-report-submissions/period-summary${buildQuery({ period })}`,
    );
  },

  list(params?: { projectId?: string; period?: string; limit?: number }) {
    return apiFetch<ProjectReportSubmissionListItem[]>(
      `/project-report-submissions${buildQuery(params ?? {})}`,
    );
  },

  get(id: string) {
    return apiFetch<ProjectReportSubmissionDetail>(
      `/project-report-submissions/${id}`,
    );
  },

  remove(id: string) {
    return apiFetch<{ id: string; deleted: boolean }>(
      `/project-report-submissions/${id}`,
      { method: 'DELETE' },
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
      },
    );
  },

  fileDownloadUrl(fileId: string) {
    return `${API_URL}/project-report-submission-files/${fileId}/download`;
  },
};
