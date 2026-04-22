'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PreviewPopup, PopupHead, PopupBody, PopupStats, PopupFooter, PopupBtn } from '@/components/preview-popup';
import { StatusBadge } from '@/components/status-badge';
import { PurposeChip, purposeFromEntry } from '@/components/handoff-card';
import { patchHandoff } from '@/lib/mutate';
import type { Handoff } from '@/lib/types';

function timeAgo(date: string): string {
  const mins = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

const STATUS_COLORS: Record<string, { text: string; bg: string }> = {
  open: { text: 'var(--orange)', bg: 'var(--orange-dim)' },
  picked_up: { text: 'var(--accent)', bg: 'var(--accent-dim)' },
  completed: { text: 'var(--green)', bg: 'var(--green-dim)' },
};

export function HandoffPopup({ handoff: handoffProp, open, onClose, onUpdate }: {
  handoff: Handoff | null;
  open: boolean;
  onClose: () => void;
  onUpdate?: () => void;
}) {
  const [copyLabel, setCopyLabel] = useState('Copy');
  const [acting, setActing] = useState(false);
  const [localHandoff, setLocalHandoff] = useState<Handoff | null>(handoffProp);

  useEffect(() => { setLocalHandoff(handoffProp); }, [handoffProp]);

  if (!localHandoff) return null;
  const handoff = localHandoff;

  const sc = STATUS_COLORS[handoff.status] || STATUS_COLORS.open;
  const pct = handoff.sections_total > 0
    ? Math.round((handoff.sections_completed / handoff.sections_total) * 100)
    : 0;

  function handleAction(newStatus: string) {
    if (acting) return;
    setActing(true);
    patchHandoff(localHandoff!.id, newStatus, {
      onSuccess: () => { setActing(false); window.dispatchEvent(new Event('handoffs-changed')); onUpdate?.(); onClose(); },
      onError: () => { setActing(false); },
    });
  }

  function handleToggleMount() {
    if (acting) return;
    const next = !localHandoff!.is_mounted;
    // Optimistic local flip so the popup reflects the new state immediately
    setLocalHandoff((h) => (h ? { ...h, is_mounted: next } : h));
    setActing(true);
    patchHandoff(localHandoff!.id, { is_mounted: next }, {
      onSuccess: () => { setActing(false); window.dispatchEvent(new Event('handoffs-changed')); onUpdate?.(); },
      onError: () => {
        setActing(false);
        // Revert on failure
        setLocalHandoff((h) => (h ? { ...h, is_mounted: !next } : h));
      },
    });
  }

  function handleCopy() {
    const remaining = (handoff!.sections_remaining || [])
      .map((s, i) => `${i + 1}. [${s.status === 'done' ? 'x' : ' '}] ${s.name}`)
      .join('\n');
    const text = [
      `# ${handoff!.scope_name}`,
      handoff!.handoff_code ? `Code: ${handoff!.handoff_code}` : null,
      `Project: ${handoff!.project_key} | Type: ${handoff!.scope_type} | Status: ${handoff!.status}`,
      `Progress: ${handoff!.sections_completed}/${handoff!.sections_total}`,
      '',
      remaining || '(no sections)',
      '',
      handoff!.notes ? `Notes: ${handoff!.notes}` : null,
    ].filter(Boolean).join('\n');
    navigator.clipboard.writeText(text).then(() => {
      setCopyLabel('Copied!');
      setTimeout(() => setCopyLabel('Copy'), 2000);
    });
  }

  return (
    <PreviewPopup open={open} onClose={onClose}>
      <PopupHead
        icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="15" x2="15" y2="15"/><line x1="9" y1="11" x2="13" y2="11"/></svg>}
        iconBg={sc.bg}
        iconColor={sc.text}
        title={handoff.scope_name}
        meta={
          <>
            {handoff.handoff_code && <span className="font-mono" style={{ color: sc.text }}>{handoff.handoff_code}</span>}
            <span>&middot;</span>
            <span style={{ color: 'var(--accent)' }}>{handoff.project_key}</span>
            <span>&middot;</span>
            <span>{timeAgo(handoff.created_at)}</span>
          </>
        }
        onClose={onClose}
      />

      <PopupBody>
      <div className="px-5 py-3.5" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Badges row — purpose + status + entry_point + scope_type + version */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <PurposeChip purpose={handoff.purpose ?? purposeFromEntry(handoff.entry_point)} />
          <StatusBadge status={handoff.status} />
          {handoff.entry_point && (
            <span
              style={{
                fontSize: 'var(--t-tiny)',
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: 'var(--r-sm)',
                background: 'var(--primary-dim)',
                color: 'var(--primary-2)',
                letterSpacing: '.04em',
              }}
            >
              {handoff.entry_point}
            </span>
          )}
          <span
            style={{
              fontSize: 'var(--t-tiny)',
              textTransform: 'uppercase',
              letterSpacing: '.04em',
              fontWeight: 600,
              color: 'var(--text3)',
            }}
          >
            {handoff.scope_type}
          </span>
          {handoff.version && (
            <span style={{ fontFamily: 'ui-monospace', fontSize: 'var(--t-tiny)', color: 'var(--text3)' }}>
              {handoff.version}
            </span>
          )}
          {handoff.is_mounted && (
            <span
              style={{
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: '.08em',
                padding: '2px 8px',
                borderRadius: 4,
                background: 'var(--primary)',
                color: '#fff',
              }}
            >
              MOUNTED
            </span>
          )}
        </div>

        {/* Progress */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 'var(--t-tiny)', color: 'var(--text3)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.06em' }}>
              Progress
            </span>
            <span style={{ fontSize: 'var(--t-tiny)', color: 'var(--text2)', fontVariantNumeric: 'tabular-nums' }}>
              {handoff.sections_completed}/{handoff.sections_total} · {pct}%
            </span>
          </div>
          <div style={{ height: 6, borderRadius: 999, background: 'var(--card-alt)', overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                width: `${pct}%`,
                background: pct === 100
                  ? 'var(--success)'
                  : 'linear-gradient(90deg, var(--primary), var(--primary-2))',
                transition: 'width .3s ease',
              }}
            />
          </div>
        </div>

        {/* Sections checklist */}
        {handoff.sections_remaining && handoff.sections_remaining.length > 0 && (
          <div>
            <p style={{ fontSize: 'var(--t-tiny)', fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>
              Sections
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 200, overflowY: 'auto' }}>
              {handoff.sections_remaining.map((s, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--t-sm)' }}>
                  <span
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: 3,
                      border: '1px solid var(--border)',
                      background: s.status === 'done' ? 'var(--success)' : 'transparent',
                      color: '#fff',
                      fontSize: 9,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {s.status === 'done' ? '✓' : ''}
                  </span>
                  <span
                    style={{
                      color: s.status === 'done' ? 'var(--text3)' : 'var(--text)',
                      textDecoration: s.status === 'done' ? 'line-through' : 'none',
                      fontSize: 'var(--t-sm)',
                      lineHeight: 1.5,
                    }}
                  >
                    {s.name}
                  </span>
                  {s.notes && (
                    <span style={{ fontSize: 'var(--t-tiny)', color: 'var(--text4)', marginLeft: 'auto' }}>
                      {s.notes}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Notes */}
        {handoff.notes && (
          <div>
            <p style={{ fontSize: 'var(--t-tiny)', fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>
              Notes
            </p>
            <p style={{ fontSize: 'var(--t-sm)', color: 'var(--text2)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
              {handoff.notes}
            </p>
          </div>
        )}

        {/* Source tag */}
        {handoff.source === 'auto' && (
          <div>
            <span style={{ fontSize: 9, fontWeight: 600, padding: '1px 6px', borderRadius: 4, background: 'var(--card)', color: 'var(--text3)' }}>
              auto
            </span>
          </div>
        )}

      </div>
      </PopupBody>

      <PopupFooter>
        <PopupBtn variant="copy" onClick={handleCopy}>{copyLabel}</PopupBtn>
        <Link
          href={`/handoff/${encodeURIComponent(handoff.id)}`}
          onClick={onClose}
          className="text-[12px] font-semibold px-3 py-1.5 rounded-[8px] text-[var(--text2)] hover:text-[var(--text)] no-underline"
        >
          Open full →
        </Link>
        {handoff.status !== 'completed' && (
          <PopupBtn variant={handoff.is_mounted ? 'ghost' : 'primary'} onClick={handleToggleMount}>
            {acting ? '…' : handoff.is_mounted ? 'Unmount' : 'Mount'}
          </PopupBtn>
        )}
        {handoff.status === 'open' && (
          <PopupBtn variant="primary" onClick={() => handleAction('picked_up')}>
            {acting ? 'Picking up...' : 'Pick Up'}
          </PopupBtn>
        )}
        {handoff.status === 'picked_up' && (
          <PopupBtn variant="primary" onClick={() => handleAction('completed')}>
            {acting ? 'Completing...' : 'Mark Completed'}
          </PopupBtn>
        )}
        {handoff.status === 'completed' && (
          <PopupBtn variant="ghost" onClick={() => handleAction('open')}>
            Reopen
          </PopupBtn>
        )}
      </PopupFooter>
    </PreviewPopup>
  );
}
