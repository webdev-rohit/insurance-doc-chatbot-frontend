import { api } from './client';
import type { QueryResponse } from './types';

/** Query (RAG) endpoint — requires auth. */
export const queryApi = {
  /** Ask a text question within a conversation. */
  text: (query: string, convoId: string) =>
    api.post<QueryResponse>('/query/text', { query, convo_id: convoId }),
};
