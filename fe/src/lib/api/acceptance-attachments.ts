import type { AcceptanceAttachment, AcceptanceAttachmentKind } from '@/lib/types';
import { API_URL, apiFetch } from './client';

export type UploadAcceptanceAttachmentPayload = {
  file: File;
  kind: AcceptanceAttachmentKind;
  note?: string;
};

export const acceptanceAttachmentsApi = {
  list(acceptanceId: string) {
    return apiFetch<AcceptanceAttachment[]>(
      `/acceptances/${acceptanceId}/attachments`,
    );
  },

  upload(acceptanceId: string, payload: UploadAcceptanceAttachmentPayload) {
    const form = new FormData();
    form.append('file', payload.file);
    form.append('kind', payload.kind);
    if (payload.note?.trim()) {
      form.append('note', payload.note.trim());
    }
    return apiFetch<AcceptanceAttachment>(
      `/acceptances/${acceptanceId}/attachments`,
      {
        method: 'POST',
        body: form,
        timeoutMs: 120_000,
      },
    );
  },

  downloadUrl(id: string) {
    return `${API_URL}/acceptance-attachments/${id}/download`;
  },

  remove(id: string) {
    return apiFetch<AcceptanceAttachment>(`/acceptance-attachments/${id}`, {
      method: 'DELETE',
    });
  },
};
