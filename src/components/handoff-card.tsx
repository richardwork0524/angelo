'use client';

import { useState } from 'react';
import { HandoffPopup } from '@/components/popups/handoff-popup';
import { StatusBadge } from '@/components/status-badge';
import type { Handoff, HandoffPurpose } from '@/lib/types';

function timeAgo(date: string): string {
  const mins = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export type { HandoffPurpose };

/** Fallback for rows missing `purpose` (shouldn't happen post-migration, but be defensive). */
export function purposeFromEntry(entry: string | null | undefined): HandoffPurpose {
  if (!entry) return 'create';
  const e = entry.toUpperCase();
  if (e.startsWith('A4')) return 'update';
  if (e.startsWith('A5')) return 'debug';
  return 'create';
}

const PURPOSE_STYLE: Record<HandoffPurpose, { bg: string; text: string }> = {
  create: { bg: 'var(--success-dim)', text: 'var(--success)' },
  debug:  { bg: 'var(--warn-dim)',    text: 'var(--warn)' },
  update: { bg: 'var(--info-dim)',    text: 'var(--info)' },
};

export function PurposeChip({ purpose }: { purpose: HandoffPurpose }) {
  const s = PURPOSE_STYLE[purpose];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        borderRadius: 999,
        background: s.bg,
        color: s.text,
        fontSize: 'var(--t-tiny)',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '.04em',
      }}
    >
      {purpose}
    </span>
  );
}

export function HandoffCard({ handoff, onUpdate }: { handoff: Handoff; onUpdate?: () => void }) {
  const [popupOpen, setPopupOpen] = useState(false);
  const mounted = handoff.is_mounted === true;
  const purpose: HandoffPurpose = handoff.purpose ?? purposeFromEntry(handoff.entry_point);
  const progress = handoff.sections_total > 0
    ? Math.round((handoff.sections_completed / handoff.sections_total) * 100)
    : 0;
  const shortId = handoff.handoff_code || handoff.id.slice(0, 8);

  return (
    <>
      <div
        onClick={() => setPopupOpen(true)}
        className="transition-all cursor-pointer hover:-translate-y-[1px]"
        style={{
          position: 'relative',
          background: mounted
            ? 'linear-gradient(135deg, rgba(99,102,241,.06) 0%, rgba(99,102,241,.01) 80%), var(--card)'
            : 'var(--card)',
          border: `1px solid ${mounted ? 'var(--primary-hi)' : 'var(--border)'}`,
          borderRadius: 'var(--r-lg)',
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          minWidth: 0,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = mounted ? 'var(--primary-hi)' : 'var(--border-hi)';
          e.currentTarget.style.boxShadow = 'var(--sh)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = mounted ? 'var(--primary-hi)' : 'var(--border)';
          e.currentTarget.style.boxShadow = 'none';
        }}
      >
        {mounted && (
          <span
            style={{
              position: 'absolute',
              top: -8,
              right: 12,
              background: 'var(--primary)',
              color: '#fff',
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: '.08em',
              padding: '3px 8px',
              borderRadius: 4,
              boxShadow: '0 2px 6px rgba(99,102,241,.4)',
            }}
          >
            MOUNTED
          </span>
        )}

        {/* Head: title + status */}
        <div className="flex items-start justify-between gap-2">
          <div
            className="truncate"
            style={{
              minWidth: 0,
              fontSize: 'var(--t-body)',
              fontWeight: 600,
              color: 'var(--text)',
              lineHeight: 1.35,
            }}
          >
            {handoff.scope_name}
          </div>
          <StatusBadge status={handoff.status} />
        </div>

        {/* Breadcrumb */}
        <div
          className="flex items-center gap-1 flex-wrap"
          style={{
            fontFamily: 'ui-monospace, monospace',
            fontSize: 'var(--t-tiny)',
          }}
        >
          <span
            style={{
              padding: '2px 6px',
              borderRadius: 3,
              background: 'var(--card-alt)',
              color: 'var(--text2)',
              fontWeight: 500,
            }}
          >
            {handoff.project_key}
          </span>
          <span style={{ color: 'var(--text4)', fontSize: 10 }}>›</span>
          <span
            style={{
              padding: '2px 6px',
              borderRadius: 3,
              background: 'var(--card-alt)',
              color: 'var(--text3)',
              textTransform: 'uppercase',
              letterSpacing: '.04em',
              fontWeight: 600,
            }}
          >
            {handoff.scope_type}
          </span>
          {handoff.entry_point && (
            <>
              <span style={{ color: 'var(--text4)', fontSize: 10 }}>›</span>
              <span
                style={{
                  padding: '2px 6px',
                  borderRadius: 3,
                  background: 'var(--primary-dim)',
                  color: 'var(--primary-2)',
                  fontWeight: 600,
                }}
              >
                {handoff.entry_point}
              </span>
            </>
          )}
          <span style={{ color: 'var(--text4)', fontSize: 10 }}>·</span>
          <span style={{ color: 'var(--text3)', letterSpacing: '.02em' }}>{shortId}</span>
        </div>

        {/* Attrs: purpose + version */}
        <div className="flex items-center gap-2 flex-wrap">
          <PurposeChip purpose={purpose} />
          {handoff.version && (
            <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, color: 'var(--text3)' }}>
              {handoff.version}
            </span>
          )}
        </div>

        {/* Progress */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span style={{ fontSize: 'var(--t-tiny)', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 500 }}>
              Progress
            </span>
            <span style={{ fontSize: 'var(--t-tiny)', color: 'var(--text2)', fontVariantNumeric: 'tabular-nums' }}>
              {handoff.sections_completed}/{handoff.sections_total} · {progress}%
            </span>
          </div>
          <div
            style={{
              height: 4,
              borderRadius: 999,
              background: 'var(--card-alt)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${progress}%`,
                background: 'linear-gradient(90deg, var(--primary), var(--primary-2))',
                transition: 'width .3s ease',
              }}
            />
          </div>
        </div>

        {/* Foot */}
        <div
          className="flex items-center justify-between"
          style={{
            marginTop: 'auto',
            paddingTop: 10,
            borderTop: '1px solid var(--border)',
            fontSize: 'var(--t-tiny)',
            color: 'var(--text3)',
          }}
        >
          <span className="truncate" style={{ minWidth: 0, marginRight: 8 }}>
            {handoff.sections_total} sections
            {handoff.vault_path && (
              <>
                <span style={{ margin: '0 4px', color: 'var(--text4)' }}>·</span>
                <span style={{ fontFamily: 'ui-monospace, monospace' }}>{handoff.vault_path}</span>
              </>
            )}
          </span>
          <span style={{ whiteSpace: 'nowrap' }}>{timeAgo(handoff.updated_at)}</span>
        </div>
      </div>

      <HandoffPopup
        handoff={handoff}
        open={popupOpen}
        onClose={() => setPopupOpen(false)}
        onUpdate={onUpdate}
      />
    </>
  );
}
