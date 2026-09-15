import type { Collection } from '@/lib/types';
import { apiFetch } from './client';

export type CollectionPayload = {
  collectionNo: string;
  period: string;
  amount: number;
  collectionDate?: string;
  note?: string;
};

export const collectionsApi = {
  list(contractId: string) {
    return apiFetch<Collection[]>(`/contracts/${contractId}/collections`);
  },

  create(contractId: string, payload: CollectionPayload) {
    return apiFetch<Collection>(`/contracts/${contractId}/collections`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  bulkUpsert(contractId: string, items: CollectionPayload[]) {
    return apiFetch<{
      count: number;
      created: number;
      updated: number;
      data: Collection[];
    }>(`/contracts/${contractId}/collections/bulk`, {
      method: 'POST',
      body: JSON.stringify({ items }),
    });
  },

  update(id: string, payload: Partial<CollectionPayload>) {
    return apiFetch<Collection>(`/collections/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  remove(id: string) {
    return apiFetch<Collection>(`/collections/${id}`, { method: 'DELETE' });
  },
};
