import type { ReactNode } from 'react';

/**
 * Renders a single line of text, turning **bold** markers into <strong>
 * elements. Everything else stays as plain text nodes (React escapes them
 * automatically), so this never touches innerHTML / dangerouslySetInnerHTML.
 */
export function renderInlineBold(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) => {
    const match = /^\*\*([^*]+)\*\*$/.exec(part);
    return match ? <strong key={i}>{match[1]}</strong> : part;
  });
}
