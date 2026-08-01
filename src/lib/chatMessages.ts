import type { QueryHistoryItem, TokenUsage } from '../api/types';

export interface ChatMessage {
  id: string;
  role: 'user' | 'bot';
  text: string;
  usage?: TokenUsage;
  error?: boolean;
  createdAt: number;
}

export function newMessageId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Turns the backend's flat list of query/response pairs into one message per side. */
export function historyToMessages(items: QueryHistoryItem[]): ChatMessage[] {
  const out: ChatMessage[] = [];
  for (const item of items) {
    const createdAt = new Date(item.created_at).getTime();
    if (item.input_text) {
      out.push({ id: `${item.id}-user`, role: 'user', text: item.input_text, createdAt });
    }
    if (item.response_text) {
      out.push({ id: `${item.id}-bot`, role: 'bot', text: item.response_text, createdAt });
    }
  }
  return out;
}
