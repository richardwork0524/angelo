'use client';

import { useEffect, useRef } from 'react';

interface ReattributionToastProps {
  sessionId: string;
  newProjectKey: string;
  previousProjectKey: string | null;
  onUndo: (sessionId: string, previousProjectKey: string | null) => Promise<void>;
  onDismiss: () => void;
}

/**
 * 5-second undo toast shown after a re-assign action.
 * Disappears on timeout or when user taps Undo.
 * Merge actions do NOT use this toast — they use MergeConfirmDialog instead.
 */
export function ReattributionToast({
  sessionId,
  newProjectKey,
  previousProjectKey,
  onUndo,
  onDismiss,
}: ReattributionToastProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    timerRef.current = setTimeout(onDismiss, 5000);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [onDismiss]);

  const handleUndo = async () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    await onUndo(sessionId, previousProjectKey);
    onDismiss();
  };

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 80,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 16px',
        background: 'var(--surface, #1c1c1e)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        fontSize: 13,
        color: 'var(--text)',
        whiteSpace: 'nowrap',
        animation: 'slideUp 180ms ease',
      }}
      role="status"
      aria-live="polite"
    >
      <span>
        Re-assigned to{' '}
        <span
          style={{
            fontFamily: 'ui-monospace, monospace',
            fontSize: 11,
            color: 'var(--primary-2)',
            padding: '1px 6px',
            background: 'var(--primary-dim)',
            borderRadius: 4,
          }}
        >
          {newProjectKey}
        </span>
      </span>
      {previousProjectKey !== undefined && (
        <button
          onClick={handleUndo}
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--primary-2)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '2px 4px',
            borderRadius: 4,
            textDecoration: 'underline',
          }}
        >
          Undo
        </button>
      )}
      <button
        onClick={onDismiss}
        style={{
          fontSize: 14,
          color: 'var(--text3)',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          lineHeight: 1,
          padding: '0 2px',
        }}
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  );
}
