'use client';

import { useState } from 'react';
import { HandoffPopup } from '@/components/popups/handoff-popup';
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

const STATUS_DOT: Record<string, string> = {
  open: 'var(--orange)',
  picked_up: 'var(--accent)',
  completed: 'var(--green)',
};

export function HandoffCard({ handoff, onUpdate }: { handoff: Handoff; onUpdate?: () => void }) {
  const [popupOpen, setPopupOpen] = useState(false);

  const pct = handoff.sections_total > 0
    ? Math.round((handoff.sections_completed / handoff.sections_total) * 100)
    : 0;
  const dotColor = STATUS_DOT[handoff.status] || 'var(--text3)';

  return (
    <>
      <button
        onClick={() => setPopupOpen(true)}
        className="w-full text-left bg-[var(--card)] rounded-[var(--r-md)] p-3.5 hover:bg-[var(--card2)] transition-colors group"
      >
        {/* Top row: code badge + title */}
        <div className="flex items-center gap-2 mb-1.5">
          {handoff.handoff_code && (
            <span className="text-[9px] font-mono font-bold px-1.5 py-[1px] rounded-[4px] bg-[var(--accent-dim)] text-[var(--accent)] shrink-0">
              {handoff.handoff_code}
            </span>
          )}
          <span className="text-[13px] font-semibold truncate text-[var(--text)] group-hover:text-[var(--accent)] transition-colors">
            {handoff.scope_name}
          </span>
        </div>

        {/* Summary line: project + scope_type + time */}
        <div className="text-[11px] text-[var(--text3)] flex items-center gap-1.5 mb-2.5">
          <span>{handoff.project_key}</span>
          <span>&middot;</span>
          <span>{handoff.scope_type}</span>
          <span>&middot;</span>
          <span>{timeAgo(handoff.created_at)}</span>
        </div>

        {/* Progress bar */}
        <div className="w-full h-1 rounded-full bg-[var(--border)] mb-2 overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${pct}%`, background: dotColor }}
          />
        </div>

        {/* Bottom row: progress dots + fraction */}
        <div className="flex items-center justify-between">
          <div className="flex gap-1">
            {Array.from({ length: Math.min(handoff.sections_total, 12) }).map((_, i) => (
              <div
                key={i}
                className="w-1.5 h-1.5 rounded-full"
                style={{
                  background: i < handoff.sections_completed ? dotColor : 'var(--border)',
                }}
              />
            ))}
            {handoff.sections_total > 12 && (
              <span className="text-[8px] text-[var(--text3)] ml-0.5">+{handoff.sections_total - 12}</span>
            )}
          </div>
          <span className="text-[10px] font-medium text-[var(--text3)]">
            {handoff.sections_completed}/{handoff.sections_total}
          </span>
        </div>
      </button>

      <HandoffPopup
        handoff={handoff}
        open={popupOpen}
        onClose={() => setPopupOpen(false)}
        onUpdate={onUpdate}
      />
    </>
  );
}
