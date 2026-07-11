type AlertKind = 'error' | 'success' | 'info';

const ICONS: Record<AlertKind, string> = { error: '⚠', success: '✓', info: 'ℹ' };

export function Alert({ kind, children }: { kind: AlertKind; children: React.ReactNode }) {
  if (!children) return null;
  return (
    <div className={`alert alert--${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      <span className="alert__icon">{ICONS[kind]}</span>
      <div>{children}</div>
    </div>
  );
}
