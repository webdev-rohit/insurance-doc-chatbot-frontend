import type { TokenUsage } from '../api/types';

/**
 * The backend persists queries/answers server-side but exposes no endpoint to
 * read a conversation's message history back. To keep threads visible across
 * reloads we cache the rendered messages in localStorage, keyed by convo id.
 * (Clearing browser storage or using another device loses this local history.)
 */
export interface ChatMessage {
  id: string;
  role: 'user' | 'bot';
  text: string;
  usage?: TokenUsage;
  error?: boolean;
  createdAt: number;
}

const keyFor = (convoId: string) => `idc.msgs.${convoId}`;

export function loadMessages(convoId: string): ChatMessage[] {
  try {
    const raw = localStorage.getItem(keyFor(convoId));
    return raw ? (JSON.parse(raw) as ChatMessage[]) : [];
  } catch {
    return [];
  }
}

export function saveMessages(convoId: string, messages: ChatMessage[]): void {
  try {
    localStorage.setItem(keyFor(convoId), JSON.stringify(messages));
  } catch {
    /* storage full / unavailable — non-fatal */
  }
}

export function clearMessages(convoId: string): void {
  localStorage.removeItem(keyFor(convoId));
}

export function newMessageId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
