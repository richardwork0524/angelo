'use client';

import { MouseEvent } from 'react';

interface ShortcutPillProps {
  label: string;
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
  className?: string;
}

/**
 * Visual keyboard shortcut indicator pill.
 * Hidden on mobile (< md breakpoint) via Tailwind `hidden md:inline-flex`.
 *
 * Use as a decorative + clickable affordance on hero cards.
 * Example: <ShortcutPill label="⌘↵ Resume" onClick={handleResume} />
 */
export function ShortcutPill({ label, onClick, className = '' }: ShortcutPillProps) {
  const base = [
    'hidden md:inline-flex items-center gap-1',
    'px-2 py-0.5 rounded',
    'text-[11px] font-mono leading-none select-none',
    'transition-colors',
    className,
  ].join(' ');

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={base}
        style={{
          background: 'var(--card-alt)',
          border: '1px solid var(--border)',
          color: 'var(--text3)',
          cursor: 'pointer',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'var(--card-hi)';
          e.currentTarget.style.color = 'var(--text2)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'var(--card-alt)';
          e.currentTarget.style.color = 'var(--text3)';
        }}
      >
        {label}
      </button>
    );
  }

  // Non-interactive decorative pill
  return (
    <span
      className={base}
      style={{
        background: 'var(--card-alt)',
        border: '1px solid var(--border)',
        color: 'var(--text3)',
      }}
    >
      {label}
    </span>
  );
}
