import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal } from '../components/Modal';
import { Spinner } from '../components/Spinner';
import { ingestionApi } from '../api/ingestion';
import { useToast } from '../context/ToastContext';
import { ApiError } from '../api/client';
import type { IngestionRecord } from '../api/types';
import {
  fileNameFromUrl,
  formatDateTime,
  isTerminal,
  statusMeta,
  statusProgress,
} from '../lib/format';

const MAX_BYTES = 50 * 1024 * 1024;
const POLL_MS = 3000;

// Name shown for a freshly-uploaded doc (the API returns empty file_url until
// the upload stage finishes), keyed by ingestion id.
type PendingNames = Record<string, string>;

export function Documents() {
  const toast = useToast();
  const [docs, setDocs] = useState<IngestionRecord[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pendingNames, setPendingNames] = useState<PendingNames>({});
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<IngestionRecord | 'all' | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const docName = useCallback(
    (d: IngestionRecord) => fileNameFromUrl(d.file_url, pendingNames[d.id] || 'document.pdf'),
    [pendingNames],
  );

  const fetchDocs = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const list = await ingestionApi.show();
      setDocs(list);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setDocs([]); // no records yet
      } else if (!silent) {
        toast.error(err instanceof ApiError ? err.message : 'Failed to load documents.');
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void fetchDocs();
  }, [fetchDocs]);

  // Poll while anything is still processing.
  const hasInFlight = docs.some((d) => !isTerminal(d.status));
  useEffect(() => {
    if (!hasInFlight) return;
    const id = window.setInterval(() => void fetchDocs(true), POLL_MS);
    return () => window.clearInterval(id);
  }, [hasInFlight, fetchDocs]);

  // Fetch the failure reason for freshly-failed docs (show() omits it).
  useEffect(() => {
    docs
      .filter((d) => d.status === 'failed' && errors[d.id] === undefined)
      .forEach(async (d) => {
        try {
          const s = await ingestionApi.status(d.id);
          setErrors((e) => ({ ...e, [d.id]: s.error_message || 'Processing failed.' }));
        } catch {
          setErrors((e) => ({ ...e, [d.id]: 'Processing failed.' }));
        }
      });
  }, [docs, errors]);

  const handleFiles = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Only PDF files are supported.');
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error('That file is larger than 50 MB.');
      return;
    }
    setUploading(true);
    try {
      const rec = await ingestionApi.upload(file);
      setPendingNames((p) => ({ ...p, [rec.id]: file.name }));
      toast.success(`“${file.name}” uploaded — processing in the background.`);
      await fetchDocs(true);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Upload failed.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (!uploading) void handleFiles(e.dataTransfer.files);
  };

  const download = async (d: IngestionRecord) => {
    setDownloadingId(d.id);
    try {
      const blob = await ingestionApi.download(d.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const base = docName(d).replace(/\.pdf$/i, '');
      a.download = `${base || 'ingestion'}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Download failed.');
    } finally {
      setDownloadingId(null);
    }
  };

  const doDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      if (confirmDelete === 'all') {
        await ingestionApi.delete();
        setDocs([]);
        toast.success('All documents deleted.');
      } else {
        await ingestionApi.delete(confirmDelete.id);
        setDocs((list) => list.filter((x) => x.id !== confirmDelete.id));
        toast.success('Document deleted.');
      }
      setConfirmDelete(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Delete failed.');
    } finally {
      setDeleting(false);
    }
  };

  const inFlight = docs.filter((d) => !isTerminal(d.status));

  return (
    <div className="main">
      <header className="topbar">
        <div>
          <h1>Documents</h1>
          <div className="topbar__sub">Upload and manage your insurance policy PDFs</div>
        </div>
        <div className="row gap-12">
          <span className="badge badge--muted">
            <span className="badge__dot" /> {docs.length} document{docs.length === 1 ? '' : 's'}
          </span>
        </div>
      </header>

      <div className="content">
        <div className="content--narrow">
          {/* ===== Upload ===== */}
          <div className="card" style={{ marginBottom: 24 }}>
            <div className="card__body">
              <div
                className={`dropzone${dragging ? ' dropzone--drag' : ''}${uploading ? ' dropzone--busy' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                onClick={() => !uploading && fileInputRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !uploading) fileInputRef.current?.click(); }}
              >
                <div className="dropzone__icon">{uploading ? <Spinner large /> : '⬆️'}</div>
                <h3>{uploading ? 'Uploading…' : 'Drop a PDF here, or click to browse'}</h3>
                <p>PDF only · up to 50&nbsp;MB. Processing runs in the background after upload.</p>
                <button className="btn btn--primary mt-16" type="button" disabled={uploading}
                  onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}>
                  Choose file
                </button>
                <input
                  ref={fileInputRef}
                  className="dropzone__file-input"
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={(e) => handleFiles(e.target.files)}
                />
              </div>
            </div>
          </div>

          {/* ===== In-flight cards ===== */}
          {inFlight.map((d) => {
            const meta = statusMeta(d.status);
            return (
              <div className="card" style={{ marginBottom: 24 }} key={d.id}>
                <div className="card__header">
                  <div className="row gap-12">
                    <span style={{ fontSize: 20 }}>📄</span>
                    <div>
                      <div className="cell-title">{docName(d)}</div>
                      <div className="text-sm text-muted">Uploaded {formatDateTime(d.created_at)}</div>
                    </div>
                  </div>
                  <span className={`badge badge--${meta.kind}`}>
                    <span className="badge__dot" /> {meta.label}
                  </span>
                </div>
                <div className="card__body">
                  <div className="progress">
                    <div className="progress__bar" style={{ width: `${statusProgress(d.status)}%` }} />
                  </div>
                  <div className="row between mt-8">
                    <span className="text-sm text-muted">{meta.label}…</span>
                    <span className="text-sm text-muted">This can take a minute</span>
                  </div>
                </div>
              </div>
            );
          })}

          {/* ===== Documents table ===== */}
          <div className="card">
            <div className="card__header">
              <h3 className="card__title">Your documents</h3>
              <div className="row gap-8">
                <button className="btn btn--ghost btn--sm" type="button" onClick={() => fetchDocs()} disabled={loading}>
                  ↻ Refresh
                </button>
                <button
                  className="btn btn--danger-ghost btn--sm"
                  type="button"
                  title="Delete all documents"
                  onClick={() => setConfirmDelete('all')}
                  disabled={docs.length === 0}
                >
                  🗑 Delete all
                </button>
              </div>
            </div>

            {loading ? (
              <div className="empty"><Spinner large /></div>
            ) : docs.length === 0 ? (
              <div className="empty">
                <div className="empty__icon">📄</div>
                <h3>No documents yet</h3>
                <p>Upload an insurance policy PDF above to start asking questions about it.</p>
              </div>
            ) : (
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>Document</th>
                      <th>Status</th>
                      <th>Chunks</th>
                      <th>Uploaded</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {docs.map((d) => {
                      const meta = statusMeta(d.status);
                      const failed = d.status === 'failed';
                      const completed = d.status === 'completed';
                      return (
                        <tr key={d.id} className={failed ? 'row--failed' : undefined}>
                          <td>
                            <div className="cell-title">{docName(d)}</div>
                            {failed && errors[d.id] && (
                              <div className="text-sm" style={{ color: 'var(--danger)' }}>{errors[d.id]}</div>
                            )}
                          </td>
                          <td>
                            <span className={`badge badge--${meta.kind}`}>
                              <span className="badge__dot" /> {meta.label}
                            </span>
                          </td>
                          <td>{d.chunk_count ?? '—'}</td>
                          <td className="text-muted">{formatDateTime(d.created_at)}</td>
                          <td>
                            <div className="row-actions">
                              <button
                                className="btn btn--subtle btn--sm"
                                type="button"
                                title={completed ? 'Download PDF + JSON (ZIP)' : 'Only available when completed'}
                                disabled={!completed || downloadingId === d.id}
                                onClick={() => download(d)}
                              >
                                {downloadingId === d.id ? <Spinner /> : '⬇ Download'}
                              </button>
                              <button
                                className="btn btn--danger-ghost btn--sm"
                                type="button"
                                title="Delete"
                                onClick={() => setConfirmDelete(d)}
                              >
                                🗑
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ===== Delete confirmation ===== */}
      <Modal
        open={confirmDelete !== null}
        onClose={() => !deleting && setConfirmDelete(null)}
        title={confirmDelete === 'all' ? 'Delete all documents?' : 'Delete this document?'}
        icon="🗑"
        danger
        actions={
          <>
            <button className="btn btn--ghost" type="button" onClick={() => setConfirmDelete(null)} disabled={deleting}>
              Cancel
            </button>
            <button className="btn btn--danger" type="button" onClick={doDelete} disabled={deleting}>
              {deleting ? <Spinner /> : confirmDelete === 'all' ? 'Delete all' : 'Delete document'}
            </button>
          </>
        }
      >
        <p className="modal__text">
          {confirmDelete === 'all' ? (
            <>This permanently removes <b>all</b> of your documents and everything indexed from them. This can’t be undone.</>
          ) : (
            <>
              This permanently removes <b>{confirmDelete ? docName(confirmDelete) : ''}</b>{' '}
              and everything indexed from it. This can’t be undone.
            </>
          )}
        </p>
      </Modal>
    </div>
  );
}
