'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PreviewPopup, PopupHead, PopupBody, PopupStats, PopupFooter, PopupBtn } from '@/components/preview-popup';
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
      onSuccess: () => { setActing(false); onUpdate?.(); onClose(); },
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
      onSuccess: () => { setActing(false); onUpdate?.(); },
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

  const titleParts = handoff.scope_name.split(/ [—–-]{1,2} /);
  const titleMain = titleParts[0];
  const titleSub = titleParts.length > 1 ? titleParts.slice(1).join(' — ') : undefined;

  return (
    <PreviewPopup open={open} onClose={onClose}>
      <PopupHead
        icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="15" x2="15" y2="15"/><line x1="9" y1="11" x2="13" y2="11"/></svg>}
        iconBg={sc.bg}
        iconColor={sc.text}
        title={titleMain}
        subtitle={titleSub}
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
      <div className="px-5 py-3.5">
        <PopupStats stats={[
          { label: 'Done', value: String(handoff.sections_completed), color: 'var(--green)' },
          { label: 'Total', value: String(handoff.sections_total) },
          { label: 'Progress', value: `${pct}%`, color: pct === 100 ? 'var(--green)' : 'var(--accent)' },
          { label: 'Status', value: handoff.status.replace('_', ' '), color: sc.text },
        ]} />

        {/* Progress bar */}
        <div className="w-full h-1.5 rounded-full bg-[var(--card)] mb-3 overflow-hidden">
          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: sc.text }} />
        </div>

        {/* Sections remaining */}
        {handoff.sections_remaining && handoff.sections_remaining.length > 0 && (
          <div className="space-y-1 mb-3 max-h-[200px] overflow-y-auto">
            <p className="text-[10px] font-semibold text-[var(--text3)] uppercase tracking-wider mb-1">Sections</p>
            {handoff.sections_remaining.map((s, i) => (
              <div key={i} className="flex items-start gap-2 text-[12px] leading-[1.5]">
                <span className="shrink-0 mt-0.5">
                  {s.status === 'done'
                    ? <span style={{ color: 'var(--green)' }}>&#x2713;</span>
                    : <span style={{ color: 'var(--text3)' }}>&#x25CB;</span>
                  }
                </span>
                <span className={s.status === 'done' ? 'text-[var(--text3)] line-through' : 'text-[var(--text)]'}>
                  {s.name}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Notes */}
        {handoff.notes && (
          <p className="text-[12px] text-[var(--text2)] leading-[1.5] mb-3">{handoff.notes}</p>
        )}

        {/* Tags */}
        <div className="flex gap-1 flex-wrap">
          <span className="text-[9px] font-semibold px-1.5 py-[1px] rounded-[4px]" style={{ background: sc.bg, color: sc.text }}>
            {handoff.scope_type}
          </span>
          {handoff.entry_point && (
            <span className="text-[9px] font-semibold px-1.5 py-[1px] rounded-[4px]" style={{ background: 'var(--purple-dim)', color: 'var(--purple)' }}>
              {handoff.entry_point}
            </span>
          )}
          {handoff.source === 'auto' && (
            <span className="text-[9px] font-semibold px-1.5 py-[1px] rounded-[4px]" style={{ background: 'var(--card)', color: 'var(--text3)' }}>
              auto
            </span>
          )}
        </div>
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
