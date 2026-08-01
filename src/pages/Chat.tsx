import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal } from '../components/Modal';
import { Spinner } from '../components/Spinner';
import { chatApi } from '../api/chat';
import { queryApi } from '../api/query';
import { useToast } from '../context/ToastContext';
import { ApiError } from '../api/client';
import type { Conversation, TokenUsage } from '../api/types';
import { formatRelative } from '../lib/format';
import { renderInlineBold } from '../lib/markdown';
import { historyToMessages, newMessageId, type ChatMessage } from '../lib/chatMessages';

const titleOr = (t: string) => (t && t.trim() ? t : 'New conversation');

export function Chat() {
  const toast = useToast();

  const [convos, setConvos] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingConvos, setLoadingConvos] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState('');

  const [renameTarget, setRenameTarget] = useState<Conversation | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renameBusy, setRenameBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Conversation | 'all' | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [expandedUsage, setExpandedUsage] = useState<Set<string>>(new Set());

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const activeConvo = useMemo(
    () => convos.find((c) => c.id === activeId) || null,
    [convos, activeId],
  );

  // ---- Load conversations --------------------------------------------------
  const fetchConvos = useCallback(async (selectFirst = false) => {
    try {
      const list = await chatApi.show();
      list.sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));
      setConvos(list);
      if (selectFirst) setActiveId((cur) => cur ?? list[0]?.id ?? null);
      return list;
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setConvos([]);
        return [];
      }
      toast.error(err instanceof ApiError ? err.message : 'Failed to load conversations.');
      return [];
    } finally {
      setLoadingConvos(false);
    }
  }, [toast]);

  useEffect(() => {
    void fetchConvos(true);
  }, [fetchConvos]);

  // ---- Load message history when active conversation changes ---------------
  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      return;
    }
    let cancelled = false;
    setLoadingMessages(true);
    chatApi
      .loadHistory(activeId)
      .then((res) => {
        if (!cancelled) setMessages(historyToMessages(res.messages));
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) {
          setMessages([]);
          return;
        }
        toast.error(err instanceof ApiError ? err.message : 'Failed to load conversation history.');
        setMessages([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingMessages(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeId, toast]);

  // ---- Autoscroll on new messages -----------------------------------------
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, sending]);

  // ---- Autosize composer ---------------------------------------------------
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [draft]);

  // ---- New chat ------------------------------------------------------------
  const newChat = async () => {
    try {
      const res = await chatApi.new();
      await fetchConvos();
      setActiveId(res.convo_id);
      setMessages([]);
      setDraft('');
      textareaRef.current?.focus();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not create a new chat.');
    }
  };

  // ---- Send a query --------------------------------------------------------
  const send = async () => {
    const text = draft.trim();
    if (!text || sending) return;

    // Ensure there's a conversation to attach to.
    let convoId = activeId;
    const isFirstMessage = messages.length === 0;
    if (!convoId) {
      try {
        const res = await chatApi.new();
        convoId = res.convo_id;
        setActiveId(convoId);
        await fetchConvos();
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : 'Could not start a conversation.');
        return;
      }
    }

    const userMsg: ChatMessage = { id: newMessageId(), role: 'user', text, createdAt: Date.now() };
    const withUser = [...messages, userMsg];
    setMessages(withUser);
    setDraft('');
    setSending(true);

    try {
      const res = await queryApi.text(text, convoId);
      const botMsg: ChatMessage = {
        id: newMessageId(),
        role: 'bot',
        text: res.answer,
        usage: res.token_usage,
        createdAt: Date.now(),
      };
      setMessages([...withUser, botMsg]);

      // Give brand-new conversations a title from the first question.
      if (isFirstMessage) {
        const title = text.length > 48 ? `${text.slice(0, 48)}…` : text;
        try {
          await chatApi.rename(convoId, title);
        } catch {
          /* best-effort */
        }
      }
      await fetchConvos(); // refresh titles + ordering (updated_at bumped)
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.status === 404
            ? 'This conversation no longer exists. Start a new chat.'
            : err.message
          : 'Something went wrong answering that. Please try again.';
      const botErr: ChatMessage = {
        id: newMessageId(),
        role: 'bot',
        text: message,
        error: true,
        createdAt: Date.now(),
      };
      setMessages([...withUser, botErr]);
    } finally {
      setSending(false);
    }
  };

  const toggleUsage = (id: string) => {
    setExpandedUsage((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const onComposerKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  // ---- Rename --------------------------------------------------------------
  const openRename = (c: Conversation) => {
    setRenameTarget(c);
    setRenameValue(c.title || '');
  };
  const doRename = async () => {
    if (!renameTarget) return;
    const name = renameValue.trim();
    if (!name) return;
    setRenameBusy(true);
    try {
      await chatApi.rename(renameTarget.id, name);
      setConvos((list) => list.map((c) => (c.id === renameTarget.id ? { ...c, title: name } : c)));
      setRenameTarget(null);
      toast.success('Conversation renamed.');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Rename failed.');
    } finally {
      setRenameBusy(false);
    }
  };

  // ---- Delete --------------------------------------------------------------
  const doDelete = async () => {
    if (!confirmDelete) return;
    setDeleteBusy(true);
    try {
      if (confirmDelete === 'all') {
        await chatApi.delete();
        setConvos([]);
        setActiveId(null);
        setMessages([]);
        toast.success('All conversations deleted.');
      } else {
        await chatApi.delete(confirmDelete.id);
        const remaining = convos.filter((c) => c.id !== confirmDelete.id);
        setConvos(remaining);
        if (activeId === confirmDelete.id) {
          setActiveId(remaining[0]?.id ?? null);
        }
        toast.success('Conversation deleted.');
      }
      setConfirmDelete(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Delete failed.');
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <div className="chat" style={{ minWidth: 0 }}>
      {/* ===== Conversations ===== */}
      <section className="convos">
        <div className="convos__head">
          <button className="btn btn--primary btn--block" type="button" onClick={newChat}>
            ＋ New chat
          </button>
        </div>

        <div className="convos__list">
          <div className="row between" style={{ padding: '8px 12px' }}>
            <span className="section-title">Recent</span>
            <button
              className="btn btn--danger-ghost btn--sm"
              type="button"
              title="Delete all chats"
              style={{ padding: '4px 8px' }}
              onClick={() => setConfirmDelete('all')}
              disabled={convos.length === 0}
            >
              🗑 Delete all
            </button>
          </div>

          {loadingConvos ? (
            <div className="convo--loading">
              <Spinner /> Loading…
            </div>
          ) : convos.length === 0 ? (
            <div className="convo--loading">No conversations yet.</div>
          ) : (
            convos.map((c) => (
              <div
                key={c.id}
                className={`convo${c.id === activeId ? ' convo--active' : ''}`}
                onClick={() => setActiveId(c.id)}
              >
                <span>💬</span>
                <div className="convo__body">
                  <div className="convo__title">{titleOr(c.title)}</div>
                  <div className="convo__meta">Updated {formatRelative(c.updated_at)}</div>
                </div>
                <div className="convo__actions">
                  <button title="Rename" onClick={(e) => { e.stopPropagation(); openRename(c); }}>✎</button>
                  <button title="Delete" onClick={(e) => { e.stopPropagation(); setConfirmDelete(c); }}>🗑</button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* ===== Thread ===== */}
      <section className="thread">
        <header className="thread__head">
          <div className="row gap-12">
            <strong>{activeConvo ? titleOr(activeConvo.title) : 'New conversation'}</strong>
          </div>
          {activeConvo && (
            <div className="row gap-8">
              <button className="btn btn--ghost btn--sm" type="button" onClick={() => openRename(activeConvo)}>
                ✎ Rename
              </button>
              <button className="btn btn--danger-ghost btn--sm" type="button" onClick={() => setConfirmDelete(activeConvo)}>
                🗑 Delete
              </button>
            </div>
          )}
        </header>

        <div className="thread__scroll" ref={scrollRef}>
          <div className="thread__inner">
            {loadingMessages ? (
              <div className="convo--loading">
                <Spinner /> Loading conversation…
              </div>
            ) : messages.length === 0 && !sending ? (
              <div className="empty">
                <div className="empty__icon">💬</div>
                <h3>Ask about your policy</h3>
                <p>
                  Ask a question about a document you’ve uploaded — grace periods, exclusions,
                  claim limits, definitions. Answers are grounded in your own PDFs.
                </p>
              </div>
            ) : (
              messages.map((m) =>
                m.role === 'user' ? (
                  <div className="msg msg--user" key={m.id}>
                    <div className="msg__body" style={{ marginLeft: 'auto', maxWidth: '80%' }}>
                      <div className="msg__name" style={{ textAlign: 'right' }}>You</div>
                      <div className="bubble">{m.text}</div>
                    </div>
                  </div>
                ) : (
                  <div className="msg msg--bot" key={m.id}>
                    <span className="msg__avatar">🛡️</span>
                    <div className="msg__body" style={{ maxWidth: '80%' }}>
                      <div className="msg__name">Insurance Bot</div>
                      <div className="bubble" style={m.error ? { color: 'var(--danger)' } : undefined}>
                        {m.text.split('\n').map((line, i) => (
                          <p key={i}>{renderInlineBold(line)}</p>
                        ))}
                      </div>
                      {m.usage && (
                        <UsageRow
                          usage={m.usage}
                          expanded={expandedUsage.has(m.id)}
                          onToggle={() => toggleUsage(m.id)}
                        />
                      )}
                    </div>
                  </div>
                ),
              )
            )}

            {sending && (
              <div className="msg msg--bot">
                <span className="msg__avatar">🛡️</span>
                <div className="msg__body">
                  <div className="msg__name">Insurance Bot</div>
                  <div className="bubble text-muted">
                    <span className="typing"><span /><span /><span /></span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Composer */}
        <div className="composer">
          <div className="composer__inner">
            <div className="composer__box">
              <textarea
                ref={textareaRef}
                rows={1}
                placeholder="Ask about your policy…"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={onComposerKey}
              />
              <button
                className="btn btn--primary btn--icon"
                type="button"
                title="Send"
                style={{ width: 40, height: 40 }}
                onClick={send}
                disabled={sending || !draft.trim()}
              >
                {sending ? <Spinner /> : '➤'}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ===== Rename modal ===== */}
      <Modal
        open={renameTarget !== null}
        onClose={() => !renameBusy && setRenameTarget(null)}
        title="Rename conversation"
        actions={
          <>
            <button className="btn btn--ghost" type="button" onClick={() => setRenameTarget(null)} disabled={renameBusy}>
              Cancel
            </button>
            <button className="btn btn--primary" type="button" onClick={doRename} disabled={renameBusy || !renameValue.trim()}>
              {renameBusy ? <Spinner /> : 'Save name'}
            </button>
          </>
        }
      >
        <p className="modal__text">Give this chat a clearer title.</p>
        <div className="field mt-16">
          <label className="label" htmlFor="newname">Conversation name</label>
          <input
            className="input"
            id="newname"
            type="text"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') doRename(); }}
            autoFocus
          />
        </div>
      </Modal>

      {/* ===== Delete modal ===== */}
      <Modal
        open={confirmDelete !== null}
        onClose={() => !deleteBusy && setConfirmDelete(null)}
        title={confirmDelete === 'all' ? 'Delete all conversations?' : 'Delete this conversation?'}
        icon="🗑"
        danger
        actions={
          <>
            <button className="btn btn--ghost" type="button" onClick={() => setConfirmDelete(null)} disabled={deleteBusy}>
              Cancel
            </button>
            <button className="btn btn--danger" type="button" onClick={doDelete} disabled={deleteBusy}>
              {deleteBusy ? <Spinner /> : confirmDelete === 'all' ? 'Delete all' : 'Delete conversation'}
            </button>
          </>
        }
      >
        <p className="modal__text">
          {confirmDelete === 'all' ? (
            <>This permanently deletes <b>all</b> of your conversations and their messages. This can’t be undone.</>
          ) : (
            <>
              This permanently deletes <b>{confirmDelete ? titleOr(confirmDelete.title) : ''}</b>{' '}
              and its messages. This can’t be undone.
            </>
          )}
        </p>
      </Modal>
    </div>
  );
}

function UsageRow({
  usage,
  expanded,
  onToggle,
}: {
  usage: TokenUsage;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="mt-8">
      <button className="btn btn--ghost btn--sm" type="button" onClick={onToggle}>
        {expanded ? 'Hide tokens' : 'Show tokens'}
      </button>
      {expanded && (
        <div className="usage" title="Token usage for this answer">
          <span>in <b>{usage.input_tokens}</b></span>
          <span>out <b>{usage.output_tokens}</b></span>
          {usage.thinking_tokens > 0 && <span>think <b>{usage.thinking_tokens}</b></span>}
          <span>total <b>{usage.total_tokens}</b></span>
        </div>
      )}
    </div>
  );
}
