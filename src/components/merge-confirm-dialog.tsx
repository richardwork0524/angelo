'use client';

interface MergeConfirmDialogProps {
  sourceTitle: string;
  targetTitle: string;
  sourceSurface: string | null;
  targetSurface: string | null;
  onConfirm: () => void;
  onCancel: () => void;
  submitting?: boolean;
}

export function MergeConfirmDialog({
  sourceTitle,
  targetTitle,
  sourceSurface,
  targetSurface,
  onConfirm,
  onCancel,
  submitting = false,
}: MergeConfirmDialogProps) {
  const surfaceMismatch = sourceSurface && targetSurface && sourceSurface !== targetSurface;

  return (
    <>
      {/* Backdrop */}
      <div
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 60 }}
        onClick={onCancel}
      />
      {/* Dialog */}
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 70,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--r)',
          padding: '20px 20px 16px',
          width: 'min(420px, calc(100vw - 32px))',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="merge-dialog-title"
      >
        {/* Header */}
        <div>
          <div id="merge-dialog-title" style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
            Merge sessions?
          </div>
          <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.5 }}>
            This cannot be undone. All events from the source session will move to the target session and the source row will be deleted.
          </div>
        </div>

        {/* Sessions being merged */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <SessionPreviewRow label="Merge" title={sourceTitle} surface={sourceSurface} color="var(--danger, var(--red))" />
          <div style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'center' }}>↓ into</div>
          <SessionPreviewRow label="Into" title={targetTitle} surface={targetSurface} color="var(--primary-2)" />
        </div>

        {/* Surface mismatch warning */}
        {surfaceMismatch && (
          <div
            style={{
              padding: '8px 12px',
              background: 'var(--warn-dim, rgba(255,159,10,0.1))',
              border: '1px solid rgba(255,159,10,0.4)',
              borderRadius: 8,
              fontSize: 12,
              color: 'var(--warn, #ff9f0a)',
              lineHeight: 1.5,
            }}
          >
            ⚠ These sessions are from different surfaces ({sourceSurface} vs {targetSurface}). Merge anyway?
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            disabled={submitting}
            style={{
              padding: '8px 16px',
              background: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              fontSize: 13,
              color: 'var(--text2)',
              cursor: 'pointer',
              opacity: submitting ? 0.5 : 1,
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={submitting}
            style={{
              padding: '8px 16px',
              background: 'transparent',
              border: '1px solid var(--danger, var(--red))',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 500,
              color: 'var(--danger, var(--red))',
              cursor: submitting ? 'not-allowed' : 'pointer',
              opacity: submitting ? 0.6 : 1,
            }}
          >
            {submitting ? 'Merging…' : 'Merge sessions'}
          </button>
        </div>
      </div>
    </>
  );
}

function SessionPreviewRow({ label, title, surface, color }: { label: string; title: string; surface: string | null; color: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 10px',
        background: 'var(--card)',
        border: `1px solid ${color}40`,
        borderRadius: 8,
      }}
    >
      <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color, letterSpacing: '.05em', minWidth: 32 }}>
        {label}
      </span>
      <span style={{ flex: 1, fontSize: 13, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {title}
      </span>
      {surface && (
        <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text3)', letterSpacing: '.04em' }}>
          {surface}
        </span>
      )}
    </div>
  );
}
