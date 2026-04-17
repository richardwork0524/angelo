'use client';

/**
 * Step tracker progress bar matching tracker.jpg reference.
 * Numbered circles connected by lines:
 * - Completed: green circle with checkmark
 * - Current: accent circle with number + chevron above
 * - Upcoming: grey circle with number
 */

interface Step {
  name: string;
  status: string;
  notes?: string | null;
}

export function StepTracker({ steps, completed }: { steps: Step[]; completed: number }) {
  const total = steps.length;
  // Current step index = completed count (0-based, so step at index `completed` is current)
  const currentIdx = completed;

  return (
    <div className="flex items-center w-full">
      {steps.map((step, i) => {
        const isDone = i < completed;
        const isCurrent = i === currentIdx && i < total;
        const isUpcoming = i > currentIdx;

        return (
          <div key={i} className="flex items-center flex-1 min-w-0 last:flex-none">
            {/* Step node */}
            <div className="flex flex-col items-center relative">
              {/* Chevron above current step */}
              {isCurrent && (
                <svg width="10" height="6" viewBox="0 0 10 6" className="mb-0.5 text-[var(--accent)]">
                  <path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
              {!isCurrent && <div className="h-[14px]" />}

              {/* Circle */}
              <div
                className="w-[22px] h-[22px] rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 transition-all"
                style={{
                  background: isDone ? 'var(--green)' : isCurrent ? 'var(--accent)' : 'var(--card2)',
                  color: isDone || isCurrent ? 'white' : 'var(--text3)',
                  border: isUpcoming ? '1.5px solid var(--border2)' : 'none',
                }}
              >
                {isDone ? (
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  i + 1
                )}
              </div>

              {/* Label */}
              <span
                className="text-[8px] font-semibold mt-1 max-w-[60px] truncate text-center leading-tight"
                style={{ color: isDone ? 'var(--green)' : isCurrent ? 'var(--text)' : 'var(--text3)' }}
                title={step.name}
              >
                {step.name.length > 12 ? step.name.slice(0, 12) + '...' : step.name}
              </span>
            </div>

            {/* Connecting line (not after last step) */}
            {i < total - 1 && (
              <div className="flex-1 mx-1 relative" style={{ top: '3px' }}>
                <div
                  className="h-[2px] w-full rounded-full"
                  style={{
                    background: i < completed ? 'var(--green)' : 'var(--border)',
                  }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Compact version for card use — shows max 6 steps, collapses labels */
export function StepTrackerCompact({ steps, completed }: { steps: Step[]; completed: number }) {
  const total = steps.length;
  const currentIdx = completed;

  return (
    <div className="flex items-center w-full gap-0">
      {steps.slice(0, 8).map((step, i) => {
        const isDone = i < completed;
        const isCurrent = i === currentIdx && i < total;

        return (
          <div key={i} className="flex items-center flex-1 min-w-0 last:flex-none">
            <div
              className="w-[16px] h-[16px] rounded-full flex items-center justify-center text-[7px] font-bold shrink-0"
              style={{
                background: isDone ? 'var(--green)' : isCurrent ? 'var(--accent)' : 'transparent',
                color: isDone || isCurrent ? 'white' : 'var(--text3)',
                border: !isDone && !isCurrent ? '1.5px solid var(--border2)' : 'none',
              }}
            >
              {isDone ? (
                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                i + 1
              )}
            </div>
            {i < Math.min(total, 8) - 1 && (
              <div className="flex-1 h-[2px] mx-0.5 rounded-full" style={{ background: i < completed ? 'var(--green)' : 'var(--border)' }} />
            )}
          </div>
        );
      })}
      {total > 8 && <span className="text-[8px] text-[var(--text3)] ml-1">+{total - 8}</span>}
    </div>
  );
}
