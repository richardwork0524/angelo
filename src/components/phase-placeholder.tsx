'use client';

import Link from 'next/link';

export function PhasePlaceholder({
  title,
  subtitle,
  phase,
  note,
}: {
  title: string;
  subtitle?: string;
  phase: number;
  note?: string;
}) {
  return (
    <div
      style={{
        padding: '24px 32px',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        minHeight: '100%',
      }}
    >
      <div className="flex items-center justify-between gap-4">
        <div style={{ fontSize: 'var(--t-h2)', fontWeight: 600, letterSpacing: '-.01em' }}>
          {title}
          {subtitle && (
            <span style={{ color: 'var(--text3)', fontWeight: 400, fontSize: 'var(--t-body)', marginLeft: 8 }}>
              {subtitle}
            </span>
          )}
        </div>
      </div>
      <div
        className="flex flex-col items-center justify-center text-center gap-2"
        style={{
          background: 'var(--card)',
          border: '1px dashed var(--border-hi)',
          borderRadius: 'var(--r-lg)',
          padding: '64px 32px',
          color: 'var(--text3)',
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 10px',
            background: 'var(--primary-dim)',
            color: 'var(--primary-2)',
            borderRadius: 999,
            fontSize: 'var(--t-tiny)',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '.04em',
          }}
        >
          Phase {phase}
        </div>
        <div style={{ fontSize: 'var(--t-h3)', fontWeight: 600, color: 'var(--text)', marginTop: 8 }}>
          Coming in Phase {phase}
        </div>
        {note && <div style={{ maxWidth: 480, fontSize: 'var(--t-sm)' }}>{note}</div>}
        <Link
          href="/"
          style={{
            marginTop: 12,
            color: 'var(--primary-2)',
            fontSize: 'var(--t-sm)',
            fontWeight: 500,
          }}
        >
          ← Back to Home
        </Link>
      </div>
    </div>
  );
}
