'use client';

import { useState } from 'react';
import { HandoffPopup } from '@/components/popups/handoff-popup';
import { StepTrackerCompact } from '@/components/step-tracker';
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

export function HandoffCard({ handoff, onUpdate }: { handoff: Handoff; onUpdate?: () => void }) {
  const [popupOpen, setPopupOpen] = useState(false);

  // Build steps from sections_remaining + completed count
  const allSteps = [
    ...Array.from({ length: handoff.sections_completed }, (_, i) => ({
      name: `Step ${i + 1}`,
      status: 'done',
    })),
    ...(handoff.sections_remaining || []),
  ];

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

        {/* Step tracker */}
        <div className="mb-1">
          <StepTrackerCompact steps={allSteps} completed={handoff.sections_completed} />
        </div>

        {/* Fraction */}
        <div className="flex justify-end">
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
