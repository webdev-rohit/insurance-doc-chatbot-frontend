import { api } from './client';
import type {
  Conversation,
  LoadHistoryResponse,
  MessageResponse,
  NewChatResponse,
  RenameChatResponse,
} from './types';

/** Chat (conversation) endpoints — all require auth. */
export const chatApi = {
  new: () => api.post<NewChatResponse>('/chat/new'),

  rename: (convoId: string, newName: string) =>
    api.post<RenameChatResponse>('/chat/rename', { convo_id: convoId, new_name: newName }),

  /** List all conversations (no id) or a single one — always returns a list. */
  show: (convoId?: string) =>
    api.action<Conversation[]>('/chat/show', { convo_id: convoId }),

  /** Full message history for a conversation, chronologically ordered. */
  loadHistory: (convoId: string) =>
    api.action<LoadHistoryResponse>('/chat/load-history', { convo_id: convoId }),

  /** Delete all (no id) or a single conversation. */
  delete: (convoId?: string) =>
    api.action<MessageResponse>('/chat/delete', { convo_id: convoId }),
};
