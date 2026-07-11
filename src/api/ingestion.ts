import { api } from './client';
import type { IngestionRecord, IngestionStatusResponse, MessageResponse } from './types';

/** Ingestion endpoints — all require auth. */
export const ingestionApi = {
  /** Upload a PDF (multipart). Returns 202 with the created record. */
  upload: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.upload<IngestionRecord>('/ingestion', form);
  },

  /** Latest status (no id) or a specific ingestion's status. */
  status: (ingestionId?: string) =>
    api.action<IngestionStatusResponse>('/ingestion/status', { ingestion_id: ingestionId }),

  /** List all records (no id) or a single one — always returns a list. */
  show: (ingestionId?: string) =>
    api.action<IngestionRecord[]>('/ingestion/show', { ingestion_id: ingestionId }),

  /** Download original PDF + extracted JSON as a ZIP blob. */
  download: (ingestionId?: string) =>
    api.download('/ingestion/download', { ingestion_id: ingestionId }),

  /** Delete all (no id) or a single record. */
  delete: (ingestionId?: string) =>
    api.action<MessageResponse>('/ingestion/delete', { ingestion_id: ingestionId }),
};
