import type { ContractAttachment, ContractAttachmentKind } from '@/lib/types';
import { API_URL, apiFetch } from './client';

export type UploadContractAttachmentPayload = {
  file: File;
  kind: ContractAttachmentKind;
  note?: string;
};

export const contractAttachmentsApi = {
  list(contractId: string) {
    return apiFetch<ContractAttachment[]>(
      `/contracts/${contractId}/attachments`,
    );
  },

  upload(contractId: string, payload: UploadContractAttachmentPayload) {
    const form = new FormData();
    form.append('file', payload.file);
    form.append('kind', payload.kind);
    if (payload.note?.trim()) {
      form.append('note', payload.note.trim());
    }
    return apiFetch<ContractAttachment>(
      `/contracts/${contractId}/attachments`,
      {
        method: 'POST',
        body: form,
        timeoutMs: 120_000,
      },
    );
  },

  downloadUrl(id: string) {
    return `${API_URL}/attachments/${id}/download`;
  },

  remove(id: string) {
    return apiFetch<ContractAttachment>(`/attachments/${id}`, {
      method: 'DELETE',
    });
  },
};
