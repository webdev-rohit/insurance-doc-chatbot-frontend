import type { IngestionStatus } from '../api/types';

/** Decode a JWT payload without verifying (client-side display only). */
export function decodeJwt(token: string): Record<string, unknown> | null {
  try {
    const payload = token.split('.')[1];
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decodeURIComponent(escape(json)));
  } catch {
    return null;
  }
}

/** Parse the backend's ISO timestamps (which have no timezone) as UTC-naive. */
function parseDate(iso: string): Date {
  // Treat a bare "2026-07-09T10:15:30" as local time (matches how it renders).
  return new Date(iso);
}

/** "Jul 9, 2026 · 10:15" */
export function formatDateTime(iso: string): string {
  const d = parseDate(iso);
  if (isNaN(d.getTime())) return iso;
  const date = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${date} · ${time}`;
}

/** Relative-ish label for conversation lists: "10:42", "Yesterday", "Jul 7". */
export function formatRelative(iso: string): string {
  const d = parseDate(iso);
  if (isNaN(d.getTime())) return iso;
  const now = new Date();
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const dayDiff = Math.round((startOfDay(now) - startOfDay(d)) / 86400000);

  if (dayDiff === 0) return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
  if (dayDiff === 1) return 'Yesterday';
  if (dayDiff < 7) return d.toLocaleDateString(undefined, { weekday: 'short' });
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function initials(first?: string, last?: string, email?: string): string {
  const a = (first || '').trim();
  const b = (last || '').trim();
  if (a || b) return ((a[0] || '') + (b[0] || '')).toUpperCase() || (a[0] || '').toUpperCase();
  if (email) return email.slice(0, 2).toUpperCase();
  return '?';
}

// ---- Ingestion status → badge styling ------------------------------------
type BadgeKind = 'success' | 'warning' | 'danger' | 'info' | 'muted';

const STATUS_META: Record<IngestionStatus, { label: string; kind: BadgeKind }> = {
  pending: { label: 'Pending', kind: 'muted' },
  uploaded: { label: 'Uploaded', kind: 'info' },
  extracting: { label: 'Extracting', kind: 'warning' },
  extracted: { label: 'Extracted', kind: 'warning' },
  indexing: { label: 'Indexing', kind: 'warning' },
  indexed: { label: 'Indexed', kind: 'warning' },
  completed: { label: 'Completed', kind: 'success' },
  failed: { label: 'Failed', kind: 'danger' },
};

export function statusMeta(status: IngestionStatus) {
  return STATUS_META[status] ?? { label: status, kind: 'muted' as BadgeKind };
}

/** Rough progress % for the in-flight card, keyed off the pipeline stage. */
export function statusProgress(status: IngestionStatus): number {
  const order: IngestionStatus[] = [
    'pending', 'uploaded', 'extracting', 'extracted', 'indexing', 'indexed', 'completed',
  ];
  const i = order.indexOf(status);
  if (status === 'failed') return 100;
  if (i < 0) return 5;
  return Math.round((i / (order.length - 1)) * 100);
}

export const TERMINAL_STATUSES: IngestionStatus[] = ['completed', 'failed'];

export function isTerminal(status: IngestionStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

/** A short filename from a GCS URL like gs://bucket/prefix/....pdf */
export function fileNameFromUrl(url: string, fallback: string): string {
  if (!url) return fallback;
  const clean = url.split('?')[0];
  const name = clean.substring(clean.lastIndexOf('/') + 1);
  try {
    return decodeURIComponent(name) || fallback;
  } catch {
    return name || fallback;
  }
}
