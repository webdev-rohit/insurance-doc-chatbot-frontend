/* ============================================================================
   Low-level HTTP client for the Insurance Doc Chatbot API.
   ----------------------------------------------------------------------------
   - Every backend endpoint uses POST.
   - Protected endpoints expect an `Authorization: Bearer <token>` header.
   - `show` / `status` / `delete` / `download` take an OPTIONAL id as a *query
     param* on a POST with an empty body.
   - Errors follow FastAPI's shape: { detail: string | ValidationError[] }.
   ========================================================================== */

// The backend is split across two independently-deployed services:
// - Ingestion service: only the `/ingestion*` paths.
// - Query service: everything else (`/auth*`, `/query*`, `/chat*`).
// Each is configured via its own base URL env var; both default to '' so dev
// keeps using the same-origin Vite proxy (see vite.config.ts).
const INGESTION_BASE_URL = (import.meta.env.VITE_INGESTION_API_BASE_URL ?? '').replace(/\/$/, '');
const QUERY_BASE_URL = (import.meta.env.VITE_QUERY_API_BASE_URL ?? '').replace(/\/$/, '');

function resolveBaseUrl(path: string): string {
  return path.startsWith('/ingestion') ? INGESTION_BASE_URL : QUERY_BASE_URL;
}

const TOKEN_KEY = 'idc.access_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}
export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

/** Raised when the API responds with a non-2xx status. */
export class ApiError extends Error {
  status: number;
  detail: unknown;
  constructor(status: number, message: string, detail: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
  }
}

/** Turn FastAPI's `detail` (string OR array of field errors) into one string. */
function messageFromDetail(detail: unknown, fallback: string): string {
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    const parts = detail
      .map((d) => {
        if (d && typeof d === 'object' && 'msg' in d) {
          const loc = Array.isArray((d as any).loc)
            ? (d as any).loc.filter((x: unknown) => x !== 'body' && x !== 'query').join('.')
            : '';
          const msg = (d as any).msg as string;
          return loc ? `${loc}: ${msg}` : msg;
        }
        return String(d);
      })
      .filter(Boolean);
    if (parts.length) return parts.join(' · ');
  }
  return fallback;
}

/**
 * Fired when any authenticated request comes back 401. The AuthProvider listens
 * for this and forces a logout + redirect to /login.
 */
export const AUTH_EXPIRED_EVENT = 'idc:auth-expired';

interface RequestOptions {
  /** JSON body (serialized) — omit for query-param-only endpoints. */
  json?: unknown;
  /** Raw body (e.g. FormData) — takes precedence over `json`. */
  body?: BodyInit;
  /** Query params appended to the URL. `undefined` values are skipped. */
  query?: Record<string, string | undefined>;
  /** Attach the bearer token (default true — most endpoints need auth). */
  auth?: boolean;
  /** Expect a binary Blob response instead of JSON (downloads). */
  blob?: boolean;
  signal?: AbortSignal;
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { json, body, query, auth = true, blob = false, signal } = opts;

  const url = new URL(resolveBaseUrl(path) + path, window.location.origin);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
    }
  }

  const headers: Record<string, string> = {};
  let finalBody: BodyInit | undefined = body;
  if (finalBody === undefined && json !== undefined) {
    headers['Content-Type'] = 'application/json';
    finalBody = JSON.stringify(json);
  }
  if (auth) {
    const token = getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(url.toString(), { method: 'POST', headers, body: finalBody, signal });
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') throw err;
    throw new ApiError(0, 'Network error — is the backend running?', err);
  }

  if (res.status === 401 && auth) {
    clearToken();
    window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT));
  }

  if (!res.ok) {
    let detail: unknown = null;
    try {
      detail = await res.json();
      if (detail && typeof detail === 'object' && 'detail' in detail) {
        detail = (detail as { detail: unknown }).detail;
      }
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(res.status, messageFromDetail(detail, res.statusText || `Request failed (${res.status})`), detail);
  }

  if (blob) return (await res.blob()) as unknown as T;

  // Some endpoints (e.g. downloads on the happy path) may return no JSON.
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export const api = {
  /** POST with a JSON body. */
  post: <T>(path: string, json?: unknown, opts?: Omit<RequestOptions, 'json'>) =>
    request<T>(path, { ...opts, json }),
  /** POST with query params only (list/status/delete/download style). */
  action: <T>(path: string, query?: Record<string, string | undefined>, opts?: RequestOptions) =>
    request<T>(path, { ...opts, query }),
  /** POST multipart form-data (upload). */
  upload: <T>(path: string, form: FormData, opts?: RequestOptions) =>
    request<T>(path, { ...opts, body: form }),
  /** POST returning a binary Blob (download). */
  download: (path: string, query?: Record<string, string | undefined>) =>
    request<Blob>(path, { query, blob: true }),
};
