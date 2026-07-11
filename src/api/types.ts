/* Shared response/request types mirrored from the backend API documentation. */

// ---- Auth -----------------------------------------------------------------
export interface RegisterRequest {
  email: string;
  first_name: string;
  last_name: string;
  password: string;
}
export interface RegisterResponse {
  message: string;
  verify_token: string;
}
export interface VerifyEmailResponse {
  message: string;
}
export interface LoginRequest {
  email: string;
  password: string;
}
export interface LoginResponse {
  access_token: string;
  token_type: string;
}
export interface ForgotPasswordResponse {
  message: string;
  reset_token: string;
}
export interface ResetPasswordResponse {
  message: string;
}

// ---- Ingestion ------------------------------------------------------------
export type IngestionStatus =
  | 'pending'
  | 'uploaded'
  | 'extracting'
  | 'extracted'
  | 'indexing'
  | 'indexed'
  | 'completed'
  | 'failed';

export interface IngestionRecord {
  id: string;
  file_url: string;
  json_url: string;
  status: IngestionStatus;
  chunk_count: number | null;
  created_at: string;
}
export interface IngestionStatusResponse {
  id: string;
  status: IngestionStatus;
  error_message: string | null;
}

// ---- Query ----------------------------------------------------------------
export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  thinking_tokens: number;
  total_tokens: number;
}
export interface QueryResponse {
  answer: string;
  token_usage: TokenUsage;
}

// ---- Chat -----------------------------------------------------------------
export interface NewChatResponse {
  message: string;
  convo_id: string;
}
export interface RenameChatResponse {
  convo_id: string;
  new_name: string;
}
export interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}
export interface MessageResponse {
  message: string;
}
