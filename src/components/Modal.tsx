import { useEffect, type ReactNode } from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children?: ReactNode;
  /** Rendered in the footer action bar (buttons). */
  actions: ReactNode;
  /** Optional icon shown above the title (e.g. a danger glyph). */
  icon?: ReactNode;
  danger?: boolean;
}

export function Modal({ open, onClose, title, children, actions, icon, danger }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="modal__body">
          {icon && (
            <div
              className="dropzone__icon"
              style={
                danger
                  ? { margin: '0 0 14px', background: 'var(--danger-bg)', color: 'var(--danger)' }
                  : { margin: '0 0 14px' }
              }
            >
              {icon}
            </div>
          )}
          <h3 className="modal__title">{title}</h3>
          {children}
        </div>
        <div className="modal__actions">{actions}</div>
      </div>
    </div>
  );
}
