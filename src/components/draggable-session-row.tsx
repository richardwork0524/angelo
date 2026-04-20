'use client';

import { useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { MergeConfirmDialog } from '@/components/merge-confirm-dialog';

export interface DraggableSessionData {
  id: string;
  session_code: string | null;
  project_key: string | null;
  title: string;
  surface: string | null;
  created_at: string;
  session_date: string;
  input_tokens: number | null;
  output_tokens: number | null;
  cost_usd: number | null;
  summary: string | null;
  mission: string | null;
  chain_id: string | null;
  entry_point: string | null;
}

interface DragState {
  isDragging: boolean;
  dragType: 'reattribute' | 'merge' | null;
}

interface DraggableSessionRowProps {
  session: DraggableSessionData;
  expanded: boolean;
  onToggle: () => void;
  heroStyle?: boolean;
  compact?: boolean;
  onReattribute: (sessionId: string, newProjectKey: string) => Promise<{ previousProjectKey: string | null }>;
  onMerge: (sourceId: string, targetId: string) => Promise<void>;
  /** Global drag state — set by parent to coordinate all rows */
  activeDragSessionId: string | null;
  onDragStart: (sessionId: string) => void;
  onDragEnd: () => void;
}

const SURFACE_COLOR: Record<string, string> = {
  CODE: 'var(--primary)',
  CHAT: 'var(--success)',
  COWORK: 'var(--vault, var(--purple))',
  MOBILE: 'var(--warn, var(--orange))',
};

function fmtTokens(n: number): string {
  if (!n) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function fmtCost(n: number): string {
  if (!n) return '$0.00';
  return `$${n.toFixed(2)}`;
}

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function DraggableSessionRow({
  session,
  expanded,
  onToggle,
  heroStyle = false,
  compact = false,
  onReattribute,
  onMerge,
  activeDragSessionId,
  onDragStart,
  onDragEnd,
}: DraggableSessionRowProps) {
  const [mergeTarget, setMergeTarget] = useState<DraggableSessionData | null>(null);
  const [isMergeSubmitting, setIsMergeSubmitting] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isDraggingThis, setIsDraggingThis] = useState(false);

  const totalTokens = (session.input_tokens || 0) + (session.output_tokens || 0);
  const surfaceColor = SURFACE_COLOR[session.surface || ''] || 'var(--text3)';
  const when = relativeTime(session.created_at);

  const isAnotherDragging = activeDragSessionId !== null && activeDragSessionId !== session.id;
  const isThisDragging = activeDragSessionId === session.id;

  // ── Drag source handlers ──
  const handleDragStart = useCallback((e: React.DragEvent) => {
    e.dataTransfer.setData('session-id', session.id);
    e.dataTransfer.setData('session-title', session.title);
    e.dataTransfer.setData('session-surface', session.surface || '');
    e.dataTransfer.effectAllowed = 'move';
    setIsDraggingThis(true);
    onDragStart(session.id);
  }, [session.id, session.title, session.surface, onDragStart]);

  const handleDragEnd = useCallback(() => {
    setIsDraggingThis(false);
    onDragEnd();
  }, [onDragEnd]);

  // ── Drop target handlers (this row as merge target) ──
  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (!isAnotherDragging) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setIsDragOver(true);
  }, [isAnotherDragging]);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const sourceId = e.dataTransfer.getData('session-id');
    const sourceTitle = e.dataTransfer.getData('session-title');
    const sourceSurface = e.dataTransfer.getData('session-surface');
    if (!sourceId || sourceId === session.id) return;
    // Show merge confirm dialog
    setMergeTarget({
      id: sourceId,
      session_code: null,
      project_key: null,
      title: sourceTitle,
      surface: sourceSurface || null,
      created_at: new Date().toISOString(),
      session_date: new Date().toISOString().slice(0, 10),
      input_tokens: null,
      output_tokens: null,
      cost_usd: null,
      summary: null,
      mission: null,
      chain_id: null,
      entry_point: null,
    });
  }, [session.id]);

  const handleMergeConfirm = useCallback(async () => {
    if (!mergeTarget) return;
    setIsMergeSubmitting(true);
    try {
      await onMerge(mergeTarget.id, session.id);
    } finally {
      setIsMergeSubmitting(false);
      setMergeTarget(null);
    }
  }, [mergeTarget, session.id, onMerge]);

  // ── Drop target border style when drag-over ──
  const dropTargetStyle = isDragOver && isAnotherDragging ? {
    border: '2px solid var(--primary)',
    background: 'var(--primary-dim)',
    boxShadow: '0 0 24px rgba(10,132,255,0.25)',
  } : {};

  // ── Dragging-this style ──
  const draggingStyle = isDraggingThis ? {
    opacity: 0.4,
    transform: 'scale(0.98)',
  } : {};

  // Compact (tertiary) row
  if (compact) {
    return (
      <>
        <div
          draggable
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 16px',
            borderBottom: '1px solid var(--border)',
            cursor: 'grab',
            transition: 'all 150ms',
            ...dropTargetStyle,
            ...draggingStyle,
          }}
        >
          <span style={{ color: 'var(--text3)', fontSize: 12, flexShrink: 0, cursor: 'grab' }}>⠿</span>
          <Link
            href={`/session/${session.id}`}
            style={{
              display: 'flex',
              flex: 1,
              alignItems: 'center',
              gap: 8,
              textDecoration: 'none',
              color: 'var(--text)',
              minWidth: 0,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, color: 'var(--text3)', minWidth: 54 }}>
              {session.session_code ? `#${session.session_code.slice(-6)}` : session.id.slice(0, 8)}
            </span>
            <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--t-sm)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text2)' }}>
              {session.title}
            </span>
            <span style={{ fontSize: 'var(--t-tiny)', color: 'var(--text3)', whiteSpace: 'nowrap' }}>{when}</span>
          </Link>
        </div>
        {mergeTarget && (
          <MergeConfirmDialog
            sourceTitle={mergeTarget.title}
            targetTitle={session.title}
            sourceSurface={mergeTarget.surface}
            targetSurface={session.surface}
            onConfirm={handleMergeConfirm}
            onCancel={() => setMergeTarget(null)}
            submitting={isMergeSubmitting}
          />
        )}
      </>
    );
  }

  // Full row
  return (
    <>
      <div
        draggable
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{
          background: heroStyle ? 'transparent' : 'var(--card)',
          border: heroStyle
            ? (isDragOver ? '2px solid var(--primary)' : 'none')
            : (isDragOver ? '2px solid var(--primary)' : '1px solid var(--border)'),
          borderRadius: heroStyle ? 0 : 'var(--r)',
          overflow: 'hidden',
          borderBottom: heroStyle ? '1px solid rgba(255,255,255,0.08)' : undefined,
          transition: 'all 150ms',
          ...(isDragOver ? { background: 'var(--primary-dim)', boxShadow: '0 0 24px rgba(10,132,255,0.25)' } : {}),
          ...draggingStyle,
        }}
      >
        {/* Drag indicator strip if being dragged over */}
        {isDragOver && isAnotherDragging && (
          <div style={{
            padding: '6px 16px',
            fontSize: 10,
            fontWeight: 600,
            color: 'var(--primary-2)',
            letterSpacing: '.05em',
            background: 'var(--primary-dim)',
            borderBottom: '1px solid rgba(10,132,255,0.2)',
          }}>
            MERGE INTO THIS SESSION
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'stretch' }}>
          {/* Drag handle */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '0 10px',
              color: 'var(--text3)',
              cursor: 'grab',
              fontSize: 14,
              flexShrink: 0,
              borderRight: heroStyle ? 'none' : '1px solid var(--border)',
            }}
            title="Drag to re-assign entity, or drop onto another session to merge"
          >
            ⠿
          </div>
          {/* Row content */}
          <button
            onClick={onToggle}
            style={{
              display: 'grid',
              gridTemplateColumns: 'auto 2fr 1fr 1fr auto',
              gap: 16,
              padding: '12px 16px',
              alignItems: 'center',
              background: 'transparent',
              border: 'none',
              width: '100%',
              cursor: 'pointer',
              textAlign: 'left',
              color: 'var(--text)',
              flex: 1,
            }}
          >
            <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 'var(--t-tiny)', color: 'var(--text3)', minWidth: 64 }}>
              {session.session_code || session.id.slice(0, 8)}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 'var(--t-sm)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {session.title}
                {session.mission && (
                  <span style={{ color: 'var(--text3)', fontWeight: 400, marginLeft: 8 }}>· {session.mission}</span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4 }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4, padding: '1px 8px',
                  borderRadius: 999, background: surfaceColor, color: '#fff',
                  fontSize: 10, fontWeight: 600, letterSpacing: '.04em',
                }}>
                  {session.surface || '—'}
                </span>
                {session.project_key && (
                  <span style={{ fontSize: 'var(--t-tiny)', color: 'var(--text3)' }}>{session.project_key}</span>
                )}
                {session.entry_point && (
                  <span style={{ fontSize: 'var(--t-tiny)', color: 'var(--text3)', padding: '1px 6px', border: '1px solid var(--border)', borderRadius: 999 }}>
                    {session.entry_point}
                  </span>
                )}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 'var(--t-sm)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                {totalTokens > 0 ? fmtTokens(totalTokens) : '—'}
              </div>
              <div style={{ fontSize: 'var(--t-tiny)', color: 'var(--text3)' }}>tokens</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 'var(--t-sm)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                {session.cost_usd ? fmtCost(Number(session.cost_usd)) : '—'}
              </div>
              <div style={{ fontSize: 'var(--t-tiny)', color: 'var(--text3)' }}>cost</div>
            </div>
            <div style={{ fontSize: 'var(--t-tiny)', color: 'var(--text3)', whiteSpace: 'nowrap' }}>{when}</div>
          </button>
        </div>

        {/* Expanded panel */}
        {expanded && (
          <div style={{ padding: '0 16px 14px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 12 }}>
            {session.summary ? (
              <p style={{ fontSize: 'var(--t-sm)', color: 'var(--text2)', lineHeight: 1.55, whiteSpace: 'pre-line', margin: 0 }}>
                {session.summary.length > 600 ? `${session.summary.slice(0, 600)}…` : session.summary}
              </p>
            ) : (
              <p style={{ fontSize: 'var(--t-sm)', color: 'var(--text3)', fontStyle: 'italic', margin: 0 }}>No summary</p>
            )}
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <Link href={`/session/${session.id}`} style={{ fontSize: 'var(--t-tiny)', color: 'var(--primary-2)', textDecoration: 'none', fontWeight: 500 }}>
                View full session →
              </Link>
              {session.chain_id && (
                <Link href={`/chain/${session.chain_id}`} style={{ fontSize: 'var(--t-tiny)', color: 'var(--text3)', textDecoration: 'none' }}>
                  Chain {session.chain_id.slice(0, 12)} →
                </Link>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Merge confirm dialog */}
      {mergeTarget && (
        <MergeConfirmDialog
          sourceTitle={mergeTarget.title}
          targetTitle={session.title}
          sourceSurface={mergeTarget.surface}
          targetSurface={session.surface}
          onConfirm={handleMergeConfirm}
          onCancel={() => setMergeTarget(null)}
          submitting={isMergeSubmitting}
        />
      )}
    </>
  );
}
